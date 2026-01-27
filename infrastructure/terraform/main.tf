# =============================================================================
# Weather Archive - Terraform Configuration (Full Infrastructure)
# =============================================================================
# This Terraform script provisions ALL AWS infrastructure for Weather Archive:
# - S3 Buckets (4 buckets)
# - RDS PostgreSQL Database
# - Lambda Functions (7 functions)
# - API Gateway with API Key
# - EventBridge scheduled rules
# - S3 event notifications
#
# Prerequisites:
# 1. AWS CLI configured with credentials
# 2. Existing Redis Cloud instance (external)
# 3. LabRole must exist in your AWS account
# =============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "weather-archive"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default security group
data "aws_security_group" "default" {
  vpc_id = data.aws_vpc.default.id
  name   = "default"
}

# =============================================================================
# Security Group Rules
# =============================================================================

# Add inbound rule for PostgreSQL to default security group
resource "aws_security_group_rule" "allow_postgres" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = data.aws_security_group.default.id
  description       = "Allow PostgreSQL access for RDS"
}

# =============================================================================
# Local Variables
# =============================================================================

locals {
  # Use LabRole for AWS Academy Learner Lab
  lambda_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"

  # Environment variables for Lambda functions
  lambda_environment_variables = {
    DB_HOST                    = aws_db_instance.main.address
    DB_PORT                    = tostring(var.db_port)
    DB_NAME                    = var.db_name
    DB_USER                    = var.db_user
    DB_PASSWORD                = var.db_password
    REDIS_HOST                 = var.redis_host
    REDIS_PORT                 = tostring(var.redis_port)
    REDIS_PASSWORD             = var.redis_password
    S3_FRONTEND_BUCKET         = aws_s3_bucket.frontend.id
    S3_RAW_IMAGES_BUCKET       = aws_s3_bucket.raw_images.id
    S3_PROCESSED_IMAGES_BUCKET = aws_s3_bucket.processed_images.id
    S3_VIDEOS_BUCKET           = aws_s3_bucket.videos.id
  }
}

# =============================================================================
# S3 Buckets
# =============================================================================

# Bucket 1: Frontend Static Files
resource "aws_s3_bucket" "frontend" {
  bucket = var.s3_frontend_bucket
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

resource "aws_s3_bucket_cors_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# Bucket 2: Raw Webcam Images (triggers PictureService Lambda)
resource "aws_s3_bucket" "raw_images" {
  bucket = var.s3_raw_images_bucket
}

resource "aws_s3_bucket_public_access_block" "raw_images" {
  bucket = aws_s3_bucket.raw_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "raw_images" {
  bucket = aws_s3_bucket.raw_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# Bucket 3: Processed Images
resource "aws_s3_bucket" "processed_images" {
  bucket = var.s3_processed_images_bucket
}

resource "aws_s3_bucket_public_access_block" "processed_images" {
  bucket = aws_s3_bucket.processed_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket 4: Generated Videos (public access for video playback)
resource "aws_s3_bucket" "videos" {
  bucket = var.s3_videos_bucket
}

resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "videos" {
  bucket = aws_s3_bucket.videos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.videos.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.videos]
}

resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# =============================================================================
# RDS PostgreSQL Database
# =============================================================================

resource "aws_db_instance" "main" {
  identifier = "${var.stack_name}-db"

  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  storage_type         = "gp2"

  db_name  = var.db_name
  username = var.db_user
  password = var.db_password

  publicly_accessible    = true
  skip_final_snapshot    = true
  deletion_protection    = false

  # Allow connections from anywhere (for Learner Lab simplicity)
  # In production, you would restrict this
  tags = {
    Name = "${var.stack_name}-db"
  }
}

# =============================================================================
# Lambda Functions
# =============================================================================

# Health Check Lambda
data "archive_file" "health" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/health"
  output_path = "${path.module}/.terraform/tmp/health.zip"
}

resource "aws_lambda_function" "health" {
  function_name = "${var.stack_name}-health"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.health.output_path
  source_code_hash = data.archive_file.health.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Autocomplete (Cities) Lambda
data "archive_file" "cities" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/cities"
  output_path = "${path.module}/.terraform/tmp/cities.zip"
}

resource "aws_lambda_function" "autocomplete" {
  function_name = "${var.stack_name}-autocomplete"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.cities.output_path
  source_code_hash = data.archive_file.cities.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Get Weather Data Lambda
data "archive_file" "weather_data" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/weather-data"
  output_path = "${path.module}/.terraform/tmp/weather-data.zip"
}

resource "aws_lambda_function" "get_weather_data" {
  function_name = "${var.stack_name}-get-weather-data"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.weather_data.output_path
  source_code_hash = data.archive_file.weather_data.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Get Video Lambda
data "archive_file" "video" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/video"
  output_path = "${path.module}/.terraform/tmp/video.zip"
}

resource "aws_lambda_function" "get_video" {
  function_name = "${var.stack_name}-get-video"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = data.archive_file.video.output_path
  source_code_hash = data.archive_file.video.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Post Weather Data Lambda (Webcam Upload)
data "archive_file" "data" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/data"
  output_path = "${path.module}/.terraform/tmp/data.zip"
}

resource "aws_lambda_function" "post_data" {
  function_name = "${var.stack_name}-post-data"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.data.output_path
  source_code_hash = data.archive_file.data.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Picture Service Lambda (Image Compression)
data "archive_file" "picture_service" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/picture-service"
  output_path = "${path.module}/.terraform/tmp/picture-service.zip"
}

resource "aws_lambda_function" "picture_service" {
  function_name = "${var.stack_name}-picture-service"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 1024

  filename         = data.archive_file.picture_service.output_path
  source_code_hash = data.archive_file.picture_service.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# Video Service Lambda (Scheduled Video Generation)
data "archive_file" "video_service" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/video-service"
  output_path = "${path.module}/.terraform/tmp/video-service.zip"
}

resource "aws_lambda_function" "video_service" {
  function_name = "${var.stack_name}-video-service"
  role          = local.lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 900
  memory_size   = 3008

  filename         = data.archive_file.video_service.output_path
  source_code_hash = data.archive_file.video_service.output_base64sha256

  environment {
    variables = local.lambda_environment_variables
  }

  depends_on = [aws_db_instance.main]
}

# =============================================================================
# S3 Event Notification for Picture Service
# =============================================================================

resource "aws_lambda_permission" "allow_s3_picture_service" {
  statement_id   = "AllowS3Invoke"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.picture_service.function_name
  principal      = "s3.amazonaws.com"
  source_arn     = aws_s3_bucket.raw_images.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_s3_bucket_notification" "raw_images" {
  bucket = aws_s3_bucket.raw_images.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.picture_service.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.allow_s3_picture_service]
}

# =============================================================================
# EventBridge Rule for Video Service (Scheduled - every hour)
# =============================================================================

resource "aws_cloudwatch_event_rule" "video_service_schedule" {
  name                = "${var.stack_name}-video-service-schedule"
  description         = "Trigger video generation every hour"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "video_service" {
  rule      = aws_cloudwatch_event_rule.video_service_schedule.name
  target_id = "VideoServiceLambda"
  arn       = aws_lambda_function.video_service.arn
}

resource "aws_lambda_permission" "allow_eventbridge_video_service" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_service.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.video_service_schedule.arn
}

# =============================================================================
# API Gateway (REST API with API Key Authentication)
# =============================================================================

resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.stack_name}-api"
  description = "Weather Archive REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.stack_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# API Gateway Resources (Paths)
# -----------------------------------------------------------------------------

resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "health"
}

resource "aws_api_gateway_resource" "cities" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "cities"
}

resource "aws_api_gateway_resource" "weather" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "weather"
}

resource "aws_api_gateway_resource" "weather_city" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.weather.id
  path_part   = "{city}"
}

resource "aws_api_gateway_resource" "video" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "video"
}

resource "aws_api_gateway_resource" "video_city" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.video.id
  path_part   = "{city}"
}

resource "aws_api_gateway_resource" "data" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "data"
}

# -----------------------------------------------------------------------------
# API Gateway Methods and Integrations
# -----------------------------------------------------------------------------

# GET /health (No API Key required)
resource "aws_api_gateway_method" "health_get" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.health.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "health_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.health.id
  http_method             = aws_api_gateway_method.health_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.health.invoke_arn
}

# GET /cities (API Key required)
resource "aws_api_gateway_method" "cities_get" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.cities.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "cities_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.cities.id
  http_method             = aws_api_gateway_method.cities_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.autocomplete.invoke_arn
}

# GET /weather/{city} (API Key required)
resource "aws_api_gateway_method" "weather_city_get" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.weather_city.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true

  request_parameters = {
    "method.request.path.city" = true
  }
}

resource "aws_api_gateway_integration" "weather_city_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.weather_city.id
  http_method             = aws_api_gateway_method.weather_city_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_weather_data.invoke_arn
}

# GET /video/{city} (API Key required)
resource "aws_api_gateway_method" "video_city_get" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.video_city.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true

  request_parameters = {
    "method.request.path.city" = true
  }
}

resource "aws_api_gateway_integration" "video_city_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.video_city.id
  http_method             = aws_api_gateway_method.video_city_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_video.invoke_arn
}

# POST /data (API Key required)
resource "aws_api_gateway_method" "data_post" {
  rest_api_id      = aws_api_gateway_rest_api.main.id
  resource_id      = aws_api_gateway_resource.data.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "data_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.data.id
  http_method             = aws_api_gateway_method.data_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.post_data.invoke_arn
}

# -----------------------------------------------------------------------------
# CORS Configuration (OPTIONS methods)
# -----------------------------------------------------------------------------

# OPTIONS /health
resource "aws_api_gateway_method" "health_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "health_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "health_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "health_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_options.http_method
  status_code = aws_api_gateway_method_response.health_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# OPTIONS /cities
resource "aws_api_gateway_method" "cities_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.cities.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cities_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cities.id
  http_method = aws_api_gateway_method.cities_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cities_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cities.id
  http_method = aws_api_gateway_method.cities_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cities_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.cities.id
  http_method = aws_api_gateway_method.cities_options.http_method
  status_code = aws_api_gateway_method_response.cities_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# OPTIONS /weather/{city}
resource "aws_api_gateway_method" "weather_city_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.weather_city.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "weather_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.weather_city.id
  http_method = aws_api_gateway_method.weather_city_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "weather_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.weather_city.id
  http_method = aws_api_gateway_method.weather_city_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "weather_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.weather_city.id
  http_method = aws_api_gateway_method.weather_city_options.http_method
  status_code = aws_api_gateway_method_response.weather_city_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# OPTIONS /video/{city}
resource "aws_api_gateway_method" "video_city_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.video_city.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "video_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.video_city.id
  http_method = aws_api_gateway_method.video_city_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "video_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.video_city.id
  http_method = aws_api_gateway_method.video_city_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "video_city_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.video_city.id
  http_method = aws_api_gateway_method.video_city_options.http_method
  status_code = aws_api_gateway_method_response.video_city_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# OPTIONS /data
resource "aws_api_gateway_method" "data_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.data.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "data_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.data.id
  http_method = aws_api_gateway_method.data_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "data_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.data.id
  http_method = aws_api_gateway_method.data_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "data_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.data.id
  http_method = aws_api_gateway_method.data_options.http_method
  status_code = aws_api_gateway_method_response.data_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# -----------------------------------------------------------------------------
# API Gateway Deployment and Stage
# -----------------------------------------------------------------------------

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.health.id,
      aws_api_gateway_resource.cities.id,
      aws_api_gateway_resource.weather.id,
      aws_api_gateway_resource.weather_city.id,
      aws_api_gateway_resource.video.id,
      aws_api_gateway_resource.video_city.id,
      aws_api_gateway_resource.data.id,
      aws_api_gateway_method.health_get.id,
      aws_api_gateway_method.cities_get.id,
      aws_api_gateway_method.weather_city_get.id,
      aws_api_gateway_method.video_city_get.id,
      aws_api_gateway_method.data_post.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.health_get,
    aws_api_gateway_integration.cities_get,
    aws_api_gateway_integration.weather_city_get,
    aws_api_gateway_integration.video_city_get,
    aws_api_gateway_integration.data_post,
    aws_api_gateway_integration.health_options,
    aws_api_gateway_integration.cities_options,
    aws_api_gateway_integration.weather_city_options,
    aws_api_gateway_integration.video_city_options,
    aws_api_gateway_integration.data_options,
  ]
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = "Prod"
}

# -----------------------------------------------------------------------------
# API Key and Usage Plan
# -----------------------------------------------------------------------------

resource "aws_api_gateway_api_key" "main" {
  name        = "${var.stack_name}-api-key"
  description = "API key for Weather Archive application"
  enabled     = true
}

resource "aws_api_gateway_usage_plan" "main" {
  name        = "${var.stack_name}-usage-plan"
  description = "Usage plan for Weather Archive API"

  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }

  quota_settings {
    limit  = 10000
    period = "DAY"
  }

  throttle_settings {
    burst_limit = 100
    rate_limit  = 50
  }
}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.main.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.main.id
}

# -----------------------------------------------------------------------------
# Lambda Permissions for API Gateway
# -----------------------------------------------------------------------------

resource "aws_lambda_permission" "api_health" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_cities" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.autocomplete.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_weather_data" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_weather_data.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_video" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_video.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_data" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_data.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Weather Archive - Terraform Outputs

# API Gateway

output "api_endpoint" {
  description = "API Gateway endpoint URL (same format as SAM output)"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/Prod/"
}

output "health_endpoint" {
  description = "Health check endpoint URL"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/Prod/health"
}

# API Key

output "api_key_id" {
  description = "API Gateway API Key ID"
  value       = aws_api_gateway_api_key.main.id
}

output "api_key_value" {
  description = "API Gateway API Key value (use with x-api-key header)"
  value       = aws_api_gateway_api_key.main.value
  sensitive   = true
}

# Lambda Functions

output "lambda_health_arn" {
  description = "ARN of the Health Lambda function"
  value       = aws_lambda_function.health.arn
}

output "lambda_autocomplete_arn" {
  description = "ARN of the Autocomplete Lambda function"
  value       = aws_lambda_function.autocomplete.arn
}

output "lambda_get_weather_data_arn" {
  description = "ARN of the Get Weather Data Lambda function"
  value       = aws_lambda_function.get_weather_data.arn
}

output "lambda_get_video_arn" {
  description = "ARN of the Get Video Lambda function"
  value       = aws_lambda_function.get_video.arn
}

output "lambda_post_data_arn" {
  description = "ARN of the Post Data Lambda function"
  value       = aws_lambda_function.post_data.arn
}

output "lambda_picture_service_arn" {
  description = "ARN of the Picture Service Lambda function"
  value       = aws_lambda_function.picture_service.arn
}

output "lambda_video_service_arn" {
  description = "ARN of the Video Service Lambda function"
  value       = aws_lambda_function.video_service.arn
}

# S3 Buckets

output "frontend_bucket_name" {
  description = "S3 bucket name for frontend hosting"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_website_url" {
  description = "S3 bucket website URL for frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "raw_images_bucket_name" {
  description = "S3 bucket name for raw images"
  value       = aws_s3_bucket.raw_images.id
}

output "processed_images_bucket_name" {
  description = "S3 bucket name for processed images"
  value       = aws_s3_bucket.processed_images.id
}

output "videos_bucket_name" {
  description = "S3 bucket name for videos"
  value       = aws_s3_bucket.videos.id
}

# Database

output "db_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_host" {
  description = "RDS PostgreSQL host (without port)"
  value       = aws_db_instance.main.address
}

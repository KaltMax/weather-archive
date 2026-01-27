# Weather Archive - Terraform Variables

variable "stack_name" {
  description = "Stack name (used for resource naming, matches SAM StackName)"
  type        = string
  default     = "weather-archive-terraform"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

# S3 Bucket Configuration

variable "s3_frontend_bucket" {
  description = "S3 bucket name for frontend static hosting"
  type        = string
  default     = "weather-archive-frontend"
}

variable "s3_raw_images_bucket" {
  description = "S3 bucket name for raw uploaded images"
  type        = string
  default     = "weather-archive-raw-images"
}

variable "s3_processed_images_bucket" {
  description = "S3 bucket name for processed/compressed images"
  type        = string
  default     = "weather-archive-processed-images"
}

variable "s3_videos_bucket" {
  description = "S3 bucket name for generated videos"
  type        = string
  default     = "weather-archive-videos"
}

# Database Configuration (RDS PostgreSQL)

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_host" {
  description = "RDS PostgreSQL host endpoint (leave empty to create new RDS)"
  type        = string
  default     = ""
}

variable "db_port" {
  description = "RDS PostgreSQL port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "postgres"
}

variable "db_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  default     = "postgres"
  sensitive   = true
}

# Redis Configuration (External Redis Cloud)

variable "redis_host" {
  description = "Redis Cloud host"
  type        = string
  default     = "redis-18058.c9.us-east-1-4.ec2.cloud.redislabs.com"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 18058
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  default     = "sASSVyRro1ityOqU32y50DJM2rB0BoJ1"
  sensitive   = true
}

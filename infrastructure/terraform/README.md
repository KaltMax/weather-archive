# Weather Archive - Terraform Infrastructure

This Terraform configuration provisions the complete AWS infrastructure for the Weather Archive application.

## Infrastructure Components

- **7 Lambda Functions** (Node.js 20.x, no VPC configuration)
  - Health check, Cities autocomplete, Weather data, Video, Post data
  - Picture Service (S3-triggered image compression)
  - Video Service (scheduled hourly video generation)
- **API Gateway** (REST API with CORS and API key authentication)
  - POST /data endpoint requires API key (x-api-key header)
  - Other endpoints are publicly accessible
- **4 S3 Buckets** (frontend, raw images, processed images, videos)
- **RDS PostgreSQL** database (publicly accessible with security group)
- **EventBridge** scheduled rule for video generation
- **IAM roles** and **Security Group rule** (PostgreSQL port 5432)

## Important Notes

- Lambda functions are **not in a VPC** - they access RDS via public endpoint
- RDS database is **publicly accessible** with a security group allowing port 5432 from anywhere
- API Gateway requires **API key** for POST /data endpoint (webcam uploads)
- Default VPC and default security group are used automatically
- Lambda dependencies must be installed **before** running Terraform (use Docker for native dependencies like sharp and ffmpeg)

## Prerequisites

1. [Terraform](https://www.terraform.io/downloads) >= 1.0.0
2. [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
3. Redis instance (AWS ElastiCache or Redis Cloud)

## Quick Start

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize Terraform
terraform init

# 4. Review the plan
terraform plan

# 5. Apply the configuration
terraform apply
```

## Configuration

### Required Variables

| Variable | Description |
|----------|-------------|
| `db_password` | PostgreSQL master password |
| `redis_host` | Redis endpoint |
| `redis_port` | Redis port (default: 6379) |
| `redis_password` | Redis password (optional, use empty string if none) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `project_name` | `weather-archive` | Project name for resource naming |
| `environment` | `dev` | Environment (dev/staging/production) |
| `aws_region` | `us-east-1` | AWS region |
| `use_lab_role` | `false` | Use AWS Academy LabRole |
| `db_instance_class` | `db.t3.micro` | RDS instance class |

## AWS Academy Learner Lab

If using AWS Academy Learner Lab, set `use_lab_role = true` in your `terraform.tfvars`. This uses the pre-existing `LabRole` instead of creating new IAM roles.

## Outputs

After `terraform apply`, you'll get:

- `api_endpoint` - API Gateway base URL
- `frontend_bucket_website_url` - Frontend website URL
- `db_endpoint` - RDS connection endpoint
- All Lambda ARNs and S3 bucket names

## Deploy Frontend

After Terraform provisioning, deploy the frontend:

```bash
# Build frontend
cd ../../frontend
npm install
npm run build

# Upload to S3
aws s3 sync dist/ s3://$(terraform -chdir=../infrastructure/terraform output -raw frontend_bucket_name)
```

get API Key
```bash
terraform output -raw api_key_value
```

init database

## Destroy Infrastructure

```bash
terraform destroy
```

**Warning:** This will delete all resources including the database. Ensure you have backups if needed.

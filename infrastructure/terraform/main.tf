terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  backend "s3" {
    bucket         = "ai-platform-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "ai-enterprise-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ── VPC ──────────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "ai-platform-vpc-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true
  enable_dns_hostnames   = true
  enable_dns_support     = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}

# ── EKS ──────────────────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "ai-platform-${var.environment}"
  cluster_version = "1.31"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    aws-ebs-csi-driver     = { most_recent = true }
    aws-efs-csi-driver     = { most_recent = true }
  }

  eks_managed_node_groups = {
    # General workload nodes
    general = {
      instance_types = ["m6i.xlarge"]
      min_size       = 2
      max_size       = 10
      desired_size   = 3
      labels = { workload = "general" }
    }
    # GPU nodes for embedding service
    gpu = {
      instance_types = ["g4dn.xlarge"]
      min_size       = 0
      max_size       = 3
      desired_size   = 1
      labels  = { workload = "gpu" }
      taints  = [{ key = "nvidia.com/gpu", value = "true", effect = "NO_SCHEDULE" }]
    }
  }

  enable_cluster_creator_admin_permissions = true
}

# ── RDS PostgreSQL ────────────────────────────────────────────
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier     = "ai-platform-${var.environment}"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = "db.r6g.large"

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  db_name  = "ai_platform"
  username = "platform_user"
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [module.rds_sg.security_group_id]

  maintenance_window              = "Mon:03:00-Mon:04:00"
  backup_window                   = "02:00-03:00"
  backup_retention_period         = 30
  deletion_protection             = true
  performance_insights_enabled    = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  parameters = [
    { name = "shared_preload_libraries", value = "pg_stat_statements,vector" }
  ]
}

# ── ElastiCache Redis ─────────────────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "ai-platform-redis-${var.environment}"
  description                = "AI Platform Redis cluster"
  engine                     = "redis"
  engine_version             = "7.2"
  node_type                  = "cache.r7g.large"
  num_cache_clusters         = 3
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [module.redis_sg.security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = true
  multi_az_enabled           = true
  snapshot_retention_limit   = 7
}

# ── S3 ────────────────────────────────────────────────────────
resource "aws_s3_bucket" "documents" {
  bucket        = "ai-platform-documents-${var.environment}-${var.aws_account_id}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── WAF ───────────────────────────────────────────────────────
resource "aws_wafv2_web_acl" "platform" {
  name  = "ai-platform-waf-${var.environment}"
  scope = "REGIONAL"

  default_action { allow {} }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimitRule"
    priority = 2
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "PlatformWAFMetric"
    sampled_requests_enabled   = true
  }
}

# ── Secrets Manager ───────────────────────────────────────────
resource "aws_secretsmanager_secret" "platform_secrets" {
  name                    = "ai-platform/${var.environment}/secrets"
  recovery_window_in_days = 7
}

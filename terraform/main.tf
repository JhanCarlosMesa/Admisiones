###############################################################################
# main.tf
# ----------------------------------------------------------------------------
# Recursos del despliegue "All Green":
#   - VPC/subnets por defecto (no creamos VPC propia para mantenerlo simple)
#   - S3 bucket para almacenar el sitio estático (dist/)
#   - Security Group: HTTP (80) abierto al mundo, SSH (22) restringido
#   - IAM Role + Instance Profile para que la EC2 pueda LEER del bucket
#   - EC2 con la AMI personalizada (Linux + Nginx) y script user_data
###############################################################################

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ----------------------------------------------------------------------------
# Datos de la cuenta y red por defecto
# ----------------------------------------------------------------------------
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ----------------------------------------------------------------------------
# S3 bucket para el sitio estático
# ----------------------------------------------------------------------------
locals {
  bucket_name = "${var.project_name}-${data.aws_caller_identity.current.account_id}-${var.environment}"
}

resource "aws_s3_bucket" "app" {
  bucket        = local.bucket_name
  force_destroy = var.app_bucket_force_destroy
}

# Permitimos lectura pública del bucket (sitio estático sin CloudFront).
# En un entorno real se pondría CloudFront con OAC en lugar de esto.
resource "aws_s3_bucket_public_access_block" "app" {
  bucket = aws_s3_bucket.app.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "app" {
  bucket     = aws_s3_bucket.app.id
  depends_on = [aws_s3_bucket_public_access_block.app]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.app.arn}/*"
      },
      {
        Sid       = "PublicListBucket"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.app.arn
      }
    ]
  })
}

# ----------------------------------------------------------------------------
# Security Group
# ----------------------------------------------------------------------------
resource "aws_security_group" "web" {
  name        = "${var.project_name}-sg-${var.environment}"
  description = "Acceso HTTP y SSH para ${var.project_name}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP desde cualquier origen"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.key_name == "" ? [] : [1]
    content {
      description = "SSH desde CIDRs autorizados"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.allowed_ssh_cidrs
    }
  }

  egress {
    description = "Salida libre"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg-${var.environment}"
  }
}

# ----------------------------------------------------------------------------
# IAM Role para que la EC2 pueda descargar el sitio desde S3
# ----------------------------------------------------------------------------
# NOTA: el usuario IAM del aula no tiene permiso para crear/adjuntar políticas
# (iam:PutRolePolicy). Para mantenerlo portable entre cuentas académicas,
# NO creamos rol IAM aquí. En su lugar, hacemos el bucket público y la EC2
# descarga los archivos con --no-sign-request (acceso anónimo).
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# EC2 con la AMI personalizada (Linux + Nginx)
# ----------------------------------------------------------------------------
resource "aws_instance" "web" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = var.key_name != "" ? var.key_name : null

  user_data = templatefile("${path.module}/user_data.sh", {
    bucket_name    = aws_s3_bucket.app.id
    region         = var.region
    nginx_web_root = var.nginx_web_root
    project_name   = var.project_name
  })

  tags = {
    Name = "${var.project_name}-web-${var.environment}"
  }
}

output "instance_id" {
  description = "ID de la instancia EC2 creada."
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "IP pública de la instancia EC2."
  value       = aws_instance.web.public_ip
}

output "public_dns" {
  description = "DNS público de la instancia EC2."
  value       = aws_instance.web.public_dns
}

output "app_url" {
  description = "URL HTTP del aplicativo desplegado."
  value       = "http://${aws_instance.web.public_dns}"
}

output "s3_bucket" {
  description = "Nombre del bucket S3 donde se sube el sitio estático."
  value       = aws_s3_bucket.app.id
}

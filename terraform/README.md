# Terraform — Admisiones UNAC

Despliegue "All Green" de la aplicación estática **Admisiones UNAC** en AWS.

## Recursos que se crean

| Recurso | Descripción |
|---------|-------------|
| `aws_s3_bucket.app` | Bucket que guarda el sitio estático (`dist/`). |
| `aws_s3_bucket_policy.app` | Política de lectura pública (sitio web estático). |
| `aws_security_group.web` | Permite HTTP (80) abierto y SSH (22) restringido. |
| `aws_iam_role.ec2_s3_reader` | Rol IAM que permite a la EC2 leer el bucket. |
| `aws_iam_instance_profile.ec2_s3_reader` | Instance profile asociado al rol. |
| `aws_instance.web` | EC2 con la AMI personalizada (Linux + Nginx). |

> Usa la **VPC por defecto** y la primera subred disponible. No crea VPC propia
> para mantenerlo simple.

## AMI requerida

La AMI debe tener preinstalado:

- Linux (Amazon Linux 2/2023, Ubuntu, etc.)
- **Nginx** sirviendo el directorio `/usr/share/nginx/html` o `/var/www/html`
- **AWS CLI** para que `user_data` pueda descargar desde S3

> Si tu Nginx usa otra ruta, pasa `TF_VAR_nginx_web_root=/la/ruta/real`.

## Comandos locales

```bash
# Inicializar
terraform init

# Ver qué se va a crear
terraform plan -var="ami_id=ami-XXXXXXXXXXXXXXXXX"

# Desplegar
terraform apply -auto-approve -var="ami_id=ami-XXXXXXXXXXXXXXXXX"

# Ver la URL
terraform output app_url

# Destruir todo (cuando termines)
terraform destroy -auto-approve -var="ami_id=ami-XXXXXXXXXXXXXXXXX"
```

## Variables

| Variable | Default | Descripción |
|----------|---------|-------------|
| `region` | `us-east-2` | Región AWS |
| `project_name` | `admisiones-unac` | Nombre para nombrar recursos |
| `environment` | `ci` | Etiqueta de entorno |
| **`ami_id`** | `ami-xxxxxxxxxxxxxxxxx` | **ID de la AMI personalizada** (cambiar obligatoriamente) |
| `instance_type` | `t3.micro` | Tamaño EC2 (free tier) |
| `key_name` | `""` | KeyPair para SSH (opcional) |
| `allowed_ssh_cidrs` | `["0.0.0.0/0"]` | CIDRs autorizados para SSH |
| `nginx_web_root` | autodetect | Ruta del web root de Nginx |
| `app_bucket_force_destroy` | `true` | Permitir borrar el bucket con objetos |

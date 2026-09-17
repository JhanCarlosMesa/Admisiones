###############################################################################
# variables.tf
# ----------------------------------------------------------------------------
# Todas las variables que se pueden sobreescribir.
# En CI/GitLab normalmente se pasan como TF_VAR_<nombre>.
###############################################################################

variable "region" {
  description = "Región de AWS donde se desplegará la infraestructura."
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Nombre del proyecto, usado para nombrar y etiquetar los recursos."
  type        = string
  default     = "admisiones-unac"
}

variable "environment" {
  description = "Etiqueta de entorno (ci, dev, prod). Se usa en el nombre de los recursos."
  type        = string
  default     = "ci"
}

# ----------------------------------------------------------------------------
# AMI
# ----------------------------------------------------------------------------
# >>> IMPORTANTE: cambia este valor por el ID de la AMI que ya creaste con
# Packer (Linux + Nginx preinstalado). Nunca se debe commitear un AMI ID real,
# normalmente se pasa desde GitLab CI como variable TF_VAR_ami_id.
# ----------------------------------------------------------------------------
variable "ami_id" {
  description = "ID de la AMI personalizada (Linux + Nginx) que se debe usar para la EC2."
  type        = string
  default     = "ami-0497c3363f8a186f8" # <- AMI ubuntu-custom-24.04-v1.0 generada con Packer
}

variable "instance_type" {
  description = "Tipo de instancia EC2 (t3.micro es elegible para free tier)."
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Nombre de un KeyPair existente para permitir SSH (opcional, dejar vacío si no se necesita)."
  type        = string
  default     = ""
}

variable "allowed_ssh_cidrs" {
  description = "CIDRs autorizados para SSH (22). En CI suele estar abierto; restringir en producción."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "nginx_web_root" {
  description = "Ruta del web root de Nginx en la AMI. Si está vacío, user_data la autodetecta."
  type        = string
  default     = ""
}

variable "app_bucket_force_destroy" {
  description = "Permite borrar el bucket S3 aunque tenga objetos (útil en pipelines efímeros)."
  type        = bool
  default     = true
}

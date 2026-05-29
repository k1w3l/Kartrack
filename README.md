# Kartrack (PT-BR)

Sistema web para registrar **abastecimentos, despesas e histórico do veículo**, com frontend moderno (React + Bootstrap), backend FastAPI e banco MySQL.

## Funcionalidades
- Dashboard com métricas em tempo real (polling a cada 10s)
- Registro de abastecimentos e despesas por veículo
- Relatórios e integração com a tabela FIPE para valor de mercado do veículo
- Importação e exportação de registros via CSV
- Backup e restauração completa dos dados
- Suporte a múltiplos veículos e múltiplos usuários (com perfil administrador)

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)

## Instalação

1. Crie um arquivo `.env` ao lado do `docker-compose.yml` com **valores próprios** (sem esses ajustes a aplicação não sobe — veja as notas abaixo):

   ```env
   # Gere uma chave forte e única: python -c "import secrets; print(secrets.token_urlsafe(48))"
   SECRET_KEY=defina-uma-chave-forte
   DB_USER=kartrack
   DB_PASSWORD=defina-uma-senha-forte
   DB_ROOT_PASSWORD=defina-uma-senha-root
   DB_NAME=kartrack
   # Domínio do frontend (separe por vírgula se houver mais de um)
   CORS_ORIGINS=http://localhost:8000
   ```

2. Crie o arquivo `docker-compose.yml` com o conteúdo abaixo:

```yaml
services:
  db:
    image: mysql:8.4
    restart: always
    container_name: kartrack_db
    environment:
      MYSQL_DATABASE: ${DB_NAME:-kartrack}
      MYSQL_USER: ${DB_USER:-kartrack}
      MYSQL_PASSWORD: ${DB_PASSWORD:?defina DB_PASSWORD no .env}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:?defina DB_ROOT_PASSWORD no .env}
      TZ: America/Sao_Paulo
    # Porta exposta só no localhost (acesso administrativo). Remova se não precisar.
    ports:
      - "127.0.0.1:3306:3306"
    volumes:
      - ./data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 10s

  app:
    image: kiwel/kartrack:latest
    restart: always
    container_name: kartrack
    env_file:
      - .env
    environment:
      DB_HOST: db
      TZ: America/Sao_Paulo
    volumes:
      - ./uploads/vehicles:/app/uploads/vehicles
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status == 200 else 1)"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
    depends_on:
      db:
        condition: service_healthy
```

3. Ajuste a permissão do diretório de uploads — o container roda como usuário **não-root (uid 1000)** e precisa gravar as fotos dos veículos:

   ```bash
   mkdir -p uploads/vehicles
   sudo chown -R 1000:1000 uploads
   ```

4. Suba o ambiente:
   ```bash
   docker compose up -d
   ```

5. Acesse: **http://localhost:8000**

> **Atualizando uma instalação existente:** `docker compose pull && docker compose up -d`. Se vier de uma versão antiga (container como root), rode o `chown` do passo 3 antes de subir.

## Variáveis de ambiente do serviço `app`

| Variável           | Descrição                                                                 | Padrão                  |
|--------------------|---------------------------------------------------------------------------|-------------------------|
| `SECRET_KEY`       | Chave para assinatura dos tokens JWT. **Obrigatória** — a aplicação **não inicia** se ficar no valor padrão | `change-me` |
| `CORS_ORIGINS`     | Origens permitidas para CORS (separadas por vírgula). Use o domínio real em produção | `http://localhost:5173` |
| `MAX_UPLOAD_BYTES` | Tamanho máximo do upload de imagem, em bytes                              | `5242880` (5 MB)        |
| `DB_HOST`          | Host do banco de dados                                                    | `db`                    |
| `DB_USER`          | Usuário do banco                                                          | `cartrack`              |
| `DB_PASSWORD`      | Senha do banco (**obrigatória** no `.env` para o compose)                 | `cartrack`              |
| `DB_ROOT_PASSWORD` | Senha root do MySQL (**obrigatória** no `.env`; usada só pelo serviço `db`) | —                       |
| `DB_NAME`          | Nome do banco                                                             | `cartrack`              |
| `DB_PORT`          | Porta do banco                                                            | `3306`                  |

> **Segurança:** o login e o cadastro têm *rate limit* (10/min e 5/min por IP). Atrás de um proxy reverso, repasse o header `X-Forwarded-For` para que o limite use o IP real do cliente.

## Personalização da marca

Os arquivos de marca padrão estão embutidos na imagem. Para substituí-los, copie os arquivos para dentro do container e reinicie:

```bash
docker cp logo_light.png kartrack:/app/uploads/logo_light.png
docker cp logo_dark.png  kartrack:/app/uploads/logo_dark.png
docker cp favicon.ico    kartrack:/app/uploads/favicon.ico
```

- `logo_light.png` — logo exibida no tema claro
- `logo_dark.png` — logo exibida no tema escuro
- `favicon.ico` — ícone do navegador

Recarregue a página após substituir.

## Acesso externo

Para expor o sistema em um domínio, configure um proxy reverso apontando para a porta `8000`. O serviço responde em um único ponto:

| Caminho      | Conteúdo                          |
|--------------|-----------------------------------|
| `/api/*`     | API REST                          |
| `/uploads/*` | Arquivos estáticos (fotos, logos) |
| `/*`         | Interface web (SPA React)         |

## Primeiro acesso

1. Abra o sistema e clique em **Primeiro acesso? Criar conta** — o primeiro usuário cadastrado torna-se administrador.
2. Após login, acesse **Meu veículo** e cadastre seu veículo.
3. (Opcional) Vá em **Registros** para importar um CSV com histórico existente.

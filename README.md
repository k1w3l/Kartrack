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

1. Crie o arquivo `docker-compose.yml` com o conteúdo abaixo e ajuste as variáveis conforme seu ambiente:

```yaml
services:
  db:
    image: mysql:8.4
    restart: always
    container_name: kartrack_db
    environment:
      MYSQL_DATABASE: kartrack
      MYSQL_USER: kartrack
      MYSQL_PASSWORD: kartrack
      MYSQL_ROOT_PASSWORD: root
      TZ: America/Sao_Paulo
    volumes:
      - ./data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 10s

  app:
    image: kiwel/kartrack:v1
    restart: always
    container_name: kartrack
    environment:
      SECRET_KEY: troque-esta-chave
      DB_HOST: db
      DB_USER: kartrack
      DB_PASSWORD: kartrack
      DB_NAME: kartrack
      TZ: America/Sao_Paulo
    volumes:
      - ./uploads/vehicles:/app/uploads/vehicles
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
```

2. Suba o ambiente:
   ```bash
   docker compose up -d
   ```

3. Acesse: **http://localhost:8000**

## Variáveis de ambiente do serviço `app`

| Variável       | Descrição                                 | Padrão        |
|----------------|-------------------------------------------|---------------|
| `SECRET_KEY`   | Chave secreta para assinatura dos tokens JWT — **altere em produção** | `change-me` |
| `DB_HOST`      | Host do banco de dados                    | `db`          |
| `DB_USER`      | Usuário do banco                          | `cartrack`    |
| `DB_PASSWORD`  | Senha do banco                            | `cartrack`    |
| `DB_NAME`      | Nome do banco                             | `cartrack`    |
| `DB_PORT`      | Porta do banco                            | `3306`        |

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

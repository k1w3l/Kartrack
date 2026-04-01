# Kartrack (PT-BR)

Sistema web para registrar **abastecimentos, despesas e histórico do veículo**, com frontend moderno (React + Bootstrap), backend FastAPI e banco MySQL, pronto para subir via Docker Compose.

## Stack
- **Frontend:** React + Vite + Bootstrap + Chart.js
- **Backend:** Python + FastAPI + SQLAlchemy + JWT
- **Banco de dados:** MySQL 8
- **Infra:** Docker Compose
- Backend stateless com token JWT
- Banco em container dedicado
- Fácil replicação via Docker Compose
- Separação de camadas pronta para crescer (serviços, filas, cache)

## Funcionalidades principais
- Dashboard com métricas em tempo real (polling a cada 10s)
- Menu com:
  - Novo abastecimento
  - Nova despesa
  - Relatórios
  - Meu veículo
  - Registros (importação/exportação CSV)
  - Configurações
  - Importação de CSV com filtro por categoria e exportação completa
  - Integração com a FIPE para atualização do valor do veículo

## Segurança e boas práticas
- Senhas com hash `pbkdf2_sha256` (Passlib)
- Autenticação JWT
- Variáveis sensíveis por `.env` (não versionar)
- CORS e validações via Pydantic
- Estrutura separada frontend/backend para escalabilidade
- Inicialização resiliente do backend com espera ativa pelo MySQL (retry automático)

## Estrutura de pastas
```bash
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   └── config.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── api.js
│   └── package.json
└── docker-compose.yml
```

## Instalação rápida
1. Copie as variáveis de ambiente do backend:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Copie o docker-compose.yml:
   ```bash
   cp docker-compose.yml.example docker-compose.yml
   ```
3. Ajuste suas configurações no docker-compose.yml
   
4. Copie o docker-compose.yml:
   ```bash
   cp frontend/vite.config.js.example frontend/vite.config.js
   ```
5. Para acessar em ambiente Dev, Home, ajustar o arquivo frontend/vite.config.js com o host onde o sistema vai rodar.
  
6. Para acesso externo, informar no campo allowedHosts do arquivo rontend/vite.config.js o seu domínio e configurar um proxy reverso para fazer o redirect para os paths /api /uploads. Verificar arquivo exemplo de conf do Nginx. 

7. Suba o ambiente:
   ```bash
   docker compose up --build
   ```
8. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:8000/docs
    
9. Para trocar a marca do sistema, envie os arquivos abaixo para `/app/uploads`:
  - `logo_light.png`: logo usada no tema claro.
  - `logo_dark.png`: logo usada no tema escuro.
  - `favicon.ico`: ícone do navegador.
- Após substituir os arquivos, recarregue o frontend para aplicar os novos logos e favicon.
   ```

## Fluxo de uso
### Primeira instalação
1. Entrar na tela inicial e clicar em **Primeiro acesso? Criar conta**.
2. Após login, abrir **Meu veículo** e cadastrar o primeiro veículo.
3. Ir em **Registros** e importar CSV (opcional).

### Demais acessos
1. Fazer login.
2. O sistema carrega automaticamente usuário e veículo principal.

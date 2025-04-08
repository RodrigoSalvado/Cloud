# Usa imagem oficial de Node 20 LTS
FROM node:20

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia apenas os ficheiros de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante código da aplicação
COPY . .

# Expõe a porta usada pela app (ajusta se for diferente)
EXPOSE 3000

# Comando para arrancar a app
CMD ["npm", "start"]

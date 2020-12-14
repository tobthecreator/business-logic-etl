FROM node:10 

WORKDIR /user/src/app

# Copying only the package.json file to the working directory
# allows for caching and faster rebuilds
COPY package*.json ./
RUN npm install

# Copy services files to working directory
COPY . .

CMD ["npm", "run", "dev"]

EXPOSE 8080
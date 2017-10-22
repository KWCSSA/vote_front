# KWCSSA voting backend

This is the backend for the voting system, it provides REST API for other parts of the voting system to use. 

To run this program, first run the following to download the node modules
```bash
npm install
```
Then create a file named `.env` at root folder to store configurations, content of the file should be key value pairs. Example:

```
dbHost=localhost
dbName=smsvoting
dbUser=user
dbPwd=hunter2
nexmoApiKey=key
nexmoApiSecret=secret
nexmoVirtualNumber=number
```
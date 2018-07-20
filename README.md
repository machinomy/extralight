# Machinomy ExtraLight

## Get started

1. Create .env file with settings (see [example.env](https://github.com/machinomy/extralight/blob/master/example.env)).
2. Install dependencies via `yarn`.
3. Run ExtraLight via `yarn start` or `yarn debug` (if you want to see debug information). 

## Settings file (.env file)

Default .env file (example.env):

```
GETH_IPC=/Users/user/Library/Ethereum/geth.ipc
AUTHORITY_URL=http://localhost:5500
```

GETH_IPC - **absolute** path to geth socket.

AUTHORITY_URL - URL of Authority server.


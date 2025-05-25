from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import json

app = FastAPI()


@app.get("/config")
async def get_config():
    try:
        with open("config.json", "r") as f:
            config_data = json.load(f)
        return JSONResponse(content=config_data)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


app.mount("/", StaticFiles(directory="static", html=True), name="static")

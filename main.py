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


@app.get("/data")
async def get_data():
    return JSONResponse(
        content={
            "temp1": {"value": 23.5},
            "led1": {"state": "on"},
            "multiled1": {
                "leds": [
                    {"state": True},
                    {"state": False},
                    {"state": True},
                    {"state": False},
                ]
            },
            "toggle1": {"state": False},
            "combo-box-1": {"option": "World"},
        }
    )


app.mount("/", StaticFiles(directory="static", html=True), name="static")

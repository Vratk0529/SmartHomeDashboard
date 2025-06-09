from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import json
import os
import threading
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

mqtt_data = {}
mqtt_lock = threading.Lock()
client = mqtt.Client()

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASS = os.getenv("MQTT_PASS")
AUTH_USER = os.getenv("AUTH_USER")
AUTH_PASS = os.getenv("AUTH_PASS")


def check_auth(request: Request):
    user = request.query_params.get("user")
    password = request.query_params.get("pass")
    if user != AUTH_USER or password != AUTH_PASS:
        raise HTTPException(status_code=401, detail="Unauthorized")


def on_connect(client, userdata, flags, rc):
    # print("Connected to MQTT broker with result code", rc)
    client.subscribe("dashboard/#")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        topic_id = msg.topic.split("/")[-1]
        # print(topic_id, payload)
        with mqtt_lock:
            mqtt_data[topic_id] = payload
    except Exception as e:
        print("Failed to parse MQTT message:", e)


def start_mqtt():
    global client
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, 60)

    thread = threading.Thread(target=client.loop_forever)
    thread.daemon = True
    thread.start()


@app.get("/config")
async def get_config(request: Request):
    check_auth(request)
    try:
        with open("config.json", "r") as f:
            config_data = json.load(f)
        return JSONResponse(content=config_data)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/data")
async def get_data(request: Request):
    check_auth(request)
    with mqtt_lock:
        return JSONResponse(content=mqtt_data)


@app.post("/command")
async def post_command(request: Request):
    check_auth(request)
    body = await request.json()
    tile_id = body.get("id")
    value = body.get("value")
    # print(f"Received command: {tile_id} = {value}")

    if tile_id:
        global client
        client.publish(f"dashboard/{tile_id}/set", json.dumps({"value": value}))

    return {"status": "ok"}


app.mount("/", StaticFiles(directory="static", html=True), name="static")

start_mqtt()

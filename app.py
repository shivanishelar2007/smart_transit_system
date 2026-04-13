from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, numpy as np
from datetime import datetime

app = Flask(__name__)
CORS(app)

model = pickle.load(open('model.pkl', 'rb'))

TRAFFIC_PATTERN = {
   0:1,1:1,2:1,3:1,4:1,5:1,
   6:2,7:3,8:3,9:3,10:2,11:2,
  12:2,13:2,14:2,15:2,16:3,17:3,
  18:3,19:3,20:2,21:2,22:1,23:1
}
TRAFFIC_DELAY = {1:0.85, 2:1.0, 3:1.40}

def current_traffic():
    return TRAFFIC_PATTERN.get(datetime.now().hour, 2)

@app.route('/')
def home():
    return "PuneRide Backend Running!"

@app.route('/predict', methods=['POST'])
def predict():
    d = request.json
    dist    = float(d.get('distance_km', 3))
    stops   = int(d.get('num_stops', 3))
    traffic = current_traffic()

    raw = model.predict([[dist, stops, traffic]])[0]
    dwell = stops * 1.5
    eta   = max(2, round((raw + dwell) * TRAFFIC_DELAY[traffic], 1))

    return jsonify({
        "eta_min":       eta,
        "traffic_level": traffic,
        "hour":          datetime.now().hour
    })

@app.route('/traffic', methods=['GET'])
def traffic_now():
    t = current_traffic()
    labels = {1:"Low",2:"Moderate",3:"Heavy"}
    return jsonify({"level": t, "label": labels[t], "hour": datetime.now().hour})

if __name__ == '__main__':
    app.run(debug=True)

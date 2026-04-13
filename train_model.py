import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
import pickle

# Realistic Pune bus route training data
# Features: distance_km, num_stops, traffic_level (1=low,2=med,3=high)
# Target: base_ride_time_min (excludes dwell and traffic — those applied separately)
data = {
    'distance_km': [1.2, 1.8, 2.5, 3.0, 3.8, 4.5, 5.2, 6.0, 7.0, 8.5,
                    9.0, 10.5, 2.0, 3.5, 5.0, 6.5, 4.0, 7.5, 8.0, 11.0],
    'num_stops':   [1,   2,   3,   3,   4,   5,   5,   6,   7,   7,
                    8,   9,   2,   4,   5,   6,   4,   6,   7,   9],
    'traffic':     [1,   1,   2,   1,   2,   3,   2,   3,   2,   3,
                    2,   3,   1,   2,   3,   2,   1,   2,   3,   3],
    'ride_min':    [6,   8,   11,  10,  15,  22,  18,  27,  22,  32,
                    28,  38,  8,   14,  22,  26,  14,  25,  30,  42]
}

df = pd.DataFrame(data)
X  = df[['distance_km','num_stops','traffic']]
y  = df['ride_min']

m = LinearRegression()
m.fit(X, y)

preds = m.predict(X)
mae   = mean_absolute_error(y, preds)
print(f"Trained! MAE = {mae:.2f} min")
print(f"Coef: dist={m.coef_[0]:.2f}, stops={m.coef_[1]:.2f}, traffic={m.coef_[2]:.2f}, intercept={m.intercept_:.2f}")

pickle.dump(m, open('model.pkl','wb'))
print("Saved model.pkl")

# Running the App (venv)

## 1) Activate the virtual environment
PowerShell:

```
..venv\Scripts\Activate.ps1
```

If you get an execution policy error:

```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
..venv\Scripts\Activate.ps1
```

## 2) Install dependencies

```
pip install -r requirements.txt
```

## 3) Run the Flask app

```
python app.py
```

The app will start at `http://127.0.0.1:5001`.

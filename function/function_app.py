import azure.functions as func
import logging
import os
import requests

CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
SECRET = os.getenv("REDDIT_SECRET")
PASSWORD = os.getenv("REDDIT_PASSWORD")

auth = requests.auth.HTTPBasicAuth(CLIENT_ID, SECRET)

data = {
    'grant_type': 'password',
    'username': 'Major-Noise-6411',
    'password': PASSWORD
}


app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="http_trigger")
def http_trigger(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    subreddit = req.params.get('subreddit')
    if not subreddit:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            subreddit = req_body.get('subreddit')

    topic = req.params.get('topic')
    if not topic:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            topic = req_body.get('topic')


    if subreddit and topic:
        return func.HttpResponse(f"Subreddit: {subreddit}\nTopic: {topic}")
    else:
        return func.HttpResponse(
            "passe todos os params",
             status_code=200
        )
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const express = require('express');
const { request } = require('http');
const app = express();

app.use(express.json());  

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}


app.get('/events', async (req, res) => {
  const auth = await authorize();
  const calendar = google.calendar({version: 'v3', auth});
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = response.data.items;
    if (!events || events.length === 0) {
      res.status(404).send('No upcoming events found.');
      return;
    }
    res.status(200).json(events);

  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).send('Failed to list events.');
  }
});


app.post('/eventCreation', async(req, res)=>{
  const auth = await authorize();
  const calendar = google.calendar({version: 'v3', auth});
  const event = {
  'summary': req.body.summary || 'nouvel evenement',
  'location': req.body.location||' 3 All. des Prairies, 59493 Villeneuve-d\'Ascq',
  'description': req.body.description||'reunion des jeunes',
  'start': {
    'dateTime': req.body.startDateTime||'2024-09-28T09:00:00',
    'timeZone': 'Europe/Paris',
  },
  'end': {
    'dateTime': req.body.endDateTime||'2024-09-28T17:00:00',
    'timeZone': 'Europe/Paris',
  },
  /*'recurrence': [
    'RRULE:FREQ=DAILY;COUNT=1'
  ],
  'attendees': [
    {'email': 'barro.nicolas@outlook.fr'},
    {'email': 'sbrin@example.com'},
  ],*/
  'reminders': {
    'useDefault': false,
    'overrides': [
      {'method': 'email', 'minutes': 24 * 60},
      {'method': 'popup', 'minutes': 10},
    ],
  },
};
console.log('Event details:', JSON.stringify(event, null, 2));
  try{
    calendar.events.insert({
  auth: auth,
  calendarId: 'primary',
  resource: event,
}, function(err, event) {
  if (err) {
    console.log('There was an error contacting the Calendar service: ' + err);
    return;
  }
});
  } catch (error){
    console.error('erreur lors de la création evenement :',  error.res ? error.res.data : error.message);
    res.status(500).send('impossible de créer evenement !');
  }
})


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './event.htm'));  
});

app.get('/eventsList', (req, res) => {
  res.sendFile(path.join(__dirname, './eventList.htm'));  
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

/* 
essayer de lister tous les évènements et permettre de les supprimer,
ajouter des options comme une affiche et autre */
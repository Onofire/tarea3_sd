-- Cargar solo los campos necesarios desde el archivo TSV
jams_reducido = LOAD 'eventos/jams.tsv' USING PigStorage('\t') AS (
  country: chararray,
  city: chararray,
  line: chararray,
  speedKMH: float,
  type: chararray,
  blockingAlertID: chararray,
  blockExpiration: long,
  uuid: chararray,
  endNode: chararray,
  speed: float,
  segments: chararray,
  street: chararray,
  id: chararray,
  blockStartTime: long,
  blockUpdate: long,
  severity: int,
  level: int,
  blockType: chararray,
  length: int,
  turnType: chararray,
  blockingAlertUuid: chararray,
  roadType: int,
  delay: int,
  blockDescription: chararray,
  updateMillis: long,
  causeAlert: chararray,
  pubMillis: long
);

filtrado = FOREACH jams_reducido GENERATE
  country,
  severity,
  city,
  speedKMH,
  type,
  endNode,
  street,
  id;

filtrado_validos = FILTER filtrado BY id IS NOT NULL AND city IS NOT NULL;

-- Cambia esta línea para usar la variable $jams_out en lugar de ruta fija
STORE filtrado_validos INTO '$jams_out' USING JsonStorage();




alerts = LOAD 'eventos/alerts.tsv' USING PigStorage('\t') AS (
  country: chararray,
  nThumbsUp: int,
  city: chararray,
  reportRating: int,
  reportByMunicipalityUser: chararray,
  reliability: int,
  type: chararray,
  fromNodeId: long,
  uuid: chararray,
  speed: float,
  reportMood: int,
  subtype: chararray,
  street: chararray,
  toNodeId: long,
  id: chararray,
  nComments: int,
  reportBy: chararray,
  inscale: boolean,
  confidence: int,
  roadType: int,
  magvar: int,
  wazeData: chararray,
  location: chararray,
  pubMillis: long,
  provider: chararray,
  providerId: chararray,
  nearBy: chararray,
  comments: chararray
);

filtrado = FOREACH alerts GENERATE
  reportBy,
  country,
  city,
  reportRating,
  reportByMunicipalityUser,
  confidence,
  reliability,
  type,
  speed,
  subtype,
  street;

-- Cambia ruta fija por variable $alerts_out
STORE filtrado INTO '$alerts_out' USING JsonStorage();



users = LOAD 'eventos/users.tsv' USING PigStorage('\t') AS (
  fleet: chararray,
  magvar: int,
  inscale: boolean,
  mood: int,
  addon: int,
  ping: int,
  location: chararray,
  id: chararray,
  userName: chararray,
  speed: float,
  ingroup: boolean
);

users_geo = FOREACH users GENERATE
  id, userName, fleet, mood, addon, ping, speed, magvar, inscale, ingroup,
  (double)REGEX_EXTRACT(location, '"y":(-?[0-9.]+)', 1) AS lat,
  (double)REGEX_EXTRACT(location, '"x":(-?[0-9.]+)', 1) AS lng;

users_filtrados = FILTER users_geo BY lat IS NOT NULL AND lng IS NOT NULL;

-- Cambia ruta fija por variable $users_out
STORE users_filtrados INTO '$users_out' USING JsonStorage();

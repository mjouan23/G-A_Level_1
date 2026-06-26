<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$stateDir = __DIR__ . '/state';
$stateFile = $stateDir . '/state.json';
$teamCount = 6;

$songs = [
  [
    'id' => 'maman-les-petits-bateaux',
    'title' => 'Maman les petits bateaux',
    'mp3' => 'musiques/maman-les-petits-bateaux.mp3',
    'prompt' => 'Mais comme la terre est ronde',
    'words' => ['ils', 'reviennent', 'chez', 'eux']
  ],
  [
    'id' => 'pirouette-cacahuete',
    'title' => 'Pirouette cacahuète',
    'mp3' => 'musiques/pirouette-cacahuete.mp3',
    'prompt' => 'Si vous voulez y monter...',
    'words' => ['vous', 'vous', 'casserez', 'le', 'bout', 'du', 'nez']
  ],
  [
    'id' => 'au-clair-de-la-lune',
    'title' => 'Au clair de la lune',
    'mp3' => 'musiques/au-clair-de-la-lune.mp3',
    'prompt' => 'Je n\'ai pas de plume,',
    'words' => ['je', 'suis', 'dans', 'mon', 'lit']
  ],
  [
    'id' => 'la-mere-michel',
    'title' => 'La mère Michel',
    'mp3' => 'musiques/la-mere-michel.mp3',
    'prompt' => 'Et le père Lustucru qui lui a répondu :',
    'words' => ['donnez', 'une', 'récompense', 'il', 'vous', 'sera', 'rendu']
  ],
  [
    'id' => 'l-araigne-gipsy',
    'title' => 'L\'araigne gipsy',
    'mp3' => 'musiques/l-araigne-gipsy.mp3',
    'prompt' => 'Gipsy tombe par-terre',
    'words' => ['mais', 'le', 'soleil', 'a', 'chassé', 'la', 'pluie']
  ],
  [
    'id' => 'un-grand-cerf',
    'title' => 'Un grand cerf',
    'mp3' => 'musiques/un-grand-cerf.mp3',
    'prompt' => 'Lapin, lapin, entre et viens...',
    'words' => ['me', 'serrer', 'la', 'main']
  ],
  [
    'id' => 'il-etait-un-petit-navire',
    'title' => 'Il était un petit navire',
    'mp3' => 'musiques/il-etait-un-petit-navire.mp3',
    'prompt' => 'On tira à la courte paille...',
    'words' => ['pour', 'savoir', 'qui', 'qui', 'qui', 'serait', 'mangé']
  ],
  [
    'id' => 'a-la-claire-fontaine',
    'title' => 'À la claire fontaine',
    'mp3' => 'musiques/a-la-claire-fontaine.mp3',
    'prompt' => 'Sur la plus haute branche,',
    'words' => ['un', 'rossignol', 'chantait']
  ],
  [
    'id' => 'ha-les-crocodiles',
    'title' => 'Ha les crocodiles',
    'mp3' => 'musiques/ha-les-crocodiles.mp3',
    'prompt' => 'Quand il ouvrait sa gueule tout entière',
    'words' => ['On', 'croyait', 'voir','ses', 'ennemis', 'dedans']
  ],
  [
    'id' => 'promenons-nous-dans-les-bois',
    'title' => 'Promenons-nous dans les bois',
    'mp3' => 'musiques/promenons-nous-dans-les-bois.mp3',
    'prompt' => 'Loup y es-tu ? Que fais-tu ? Entends-tu ?',
    'words' => ['je', 'mets', 'ma', 'culotte']
  ]
];

if (!is_dir($stateDir)) {
  mkdir($stateDir, 0777, true);
}

function default_state() {
  return [
    'songIndex' => 0,
    'round' => 1,
    'revealed' => false,
    'introDone' => false,
    'participants' => new stdClass(),
    'submissions' => new stdClass()
  ];
}

function read_state($stateFile) {
  if (!file_exists($stateFile)) {
    return default_state();
  }

  $data = json_decode(file_get_contents($stateFile), true);
  if (!is_array($data)) {
    return default_state();
  }

  $data += default_state();
  if (!isset($data['participants']) || !is_array($data['participants'])) {
    $data['participants'] = new stdClass();
  }
  if (!isset($data['submissions']) || !is_array($data['submissions'])) {
    $data['submissions'] = new stdClass();
  }

  return $data;
}

function write_state($stateFile, $state) {
  file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function participant_count($participants, $teamCount) {
  if (!is_array($participants)) {
    return 0;
  }

  return count(array_filter(array_keys($participants), function ($teamIndex) use ($teamCount) {
    $index = intval($teamIndex);
    return $index >= 0 && $index < $teamCount;
  }));
}

function output_state($state, $songs, $teamCount) {
  $songIndex = max(0, min(count($songs) - 1, intval($state['songIndex'])));
  $state['songIndex'] = $songIndex;
  $state['songs'] = $songs;
  $state['currentSong'] = $songs[$songIndex];
  $state['teamCount'] = $teamCount;
  $state['participantCount'] = participant_count($state['participants'], $teamCount);
  $state['ready'] = $state['participantCount'] >= $teamCount;
  echo json_encode($state, JSON_UNESCAPED_UNICODE);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$state = read_state($stateFile);

if ($method === 'GET') {
  output_state($state, $songs, $teamCount);
}

$payload = json_decode(file_get_contents('php://input'), true);
$action = $payload['action'] ?? '';

if ($action === 'restart') {
  $state = default_state();
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}
if ($action === 'join') {
  $teamIndex = strval(intval($payload['teamIndex'] ?? -1));
  if (!isset($state['participants']) || !is_array($state['participants'])) {
    $state['participants'] = [];
  }

  $state['participants'][$teamIndex] = [
    'joinedAt' => time()
  ];
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}

if ($action === 'reset') {
  $songIndex = intval($payload['songIndex'] ?? 0);
  $state['songIndex'] = max(0, min(count($songs) - 1, $songIndex));
  $state['round'] = intval($state['round'] ?? 0) + 1;
  $state['revealed'] = false;
  $state['introDone'] = false;
  $state['submissions'] = new stdClass();
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}

if ($action === 'introDone') {
  $state['introDone'] = true;
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}

if ($action === 'submit') {
  $teamIndex = strval(intval($payload['teamIndex'] ?? -1));
  $words = $payload['words'] ?? [];
  if (!is_array($words)) {
    $words = [];
  }

  $cleanWords = array_map(function ($word) {
    return trim(strval($word));
  }, $words);

  if (!isset($state['participants']) || !is_array($state['participants'])) {
    $state['participants'] = [];
  }
  $state['participants'][$teamIndex] = ['joinedAt' => time()];

  if (!isset($state['submissions']) || !is_array($state['submissions'])) {
    $state['submissions'] = [];
  }

  $state['submissions'][$teamIndex] = [
    'words' => $cleanWords,
    'submittedAt' => time()
  ];
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}

if ($action === 'reveal') {
  $state['revealed'] = true;
  write_state($stateFile, $state);
  output_state($state, $songs, $teamCount);
}

http_response_code(400);
echo json_encode(['error' => 'Action inconnue']);

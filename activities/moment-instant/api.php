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

$teams = [
  ['index' => 0, 'name' => 'Ninou', 'photos' => [1, 2]],
  ['index' => 1, 'name' => 'Loulou', 'photos' => [3, 4]],
  ['index' => 2, 'name' => 'Davy', 'photos' => [5, 6]],
  ['index' => 3, 'name' => 'Croquette', 'photos' => [7, 8]],
  ['index' => 4, 'name' => 'Ta-ta', 'photos' => [9, 10]],
  ['index' => 5, 'name' => 'A-ten !', 'photos' => [11, 12]]
];

if (!is_dir($stateDir)) {
  mkdir($stateDir, 0777, true);
}

function default_state() {
  return [
    'round' => 1,
    'participants' => new stdClass(),
    'votes' => new stdClass()
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
  if (!isset($data['votes']) || !is_array($data['votes'])) {
    $data['votes'] = new stdClass();
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

function owner_for_photo($photoNumber, $teams) {
  foreach ($teams as $team) {
    if (in_array($photoNumber, $team['photos'], true)) {
      return $team['index'];
    }
  }
  return null;
}

function valid_votes_for_team($teamIndex, $votes, $teams) {
  if (!is_array($votes)) {
    return [];
  }

  $ownPhotos = $teams[$teamIndex]['photos'] ?? [];
  $cleanVotes = [];

  foreach ($votes as $vote) {
    $photoNumber = intval($vote);
    if ($photoNumber < 1 || $photoNumber > 12) {
      continue;
    }
    if (in_array($photoNumber, $ownPhotos, true)) {
      continue;
    }
    if (!in_array($photoNumber, $cleanVotes, true)) {
      $cleanVotes[] = $photoNumber;
    }
  }

  return array_slice($cleanVotes, 0, 2);
}

function tally_votes($votes, $teams) {
  $photoScores = [];
  $teamScores = [];

  foreach ($teams as $team) {
    foreach ($team['photos'] as $photo) {
      $photoScores[strval($photo)] = 0;
    }
    $teamScores[strval($team['index'])] = 0;
  }

  if (is_array($votes)) {
    foreach ($votes as $teamVote) {
      $selectedPhotos = $teamVote['photos'] ?? [];
      if (!is_array($selectedPhotos)) {
        continue;
      }

      foreach ($selectedPhotos as $photoNumber) {
        $photoNumber = intval($photoNumber);
        $ownerIndex = owner_for_photo($photoNumber, $teams);
        if ($ownerIndex === null) {
          continue;
        }
        $photoScores[strval($photoNumber)] += 1;
        $teamScores[strval($ownerIndex)] += 1;
      }
    }
  }

  return [
    'photos' => $photoScores,
    'teams' => $teamScores
  ];
}

function output_state($state, $teams, $teamCount) {
  $state['teams'] = $teams;
  $state['teamCount'] = $teamCount;
  $state['participantCount'] = participant_count($state['participants'], $teamCount);
  $state['ready'] = $state['participantCount'] >= $teamCount;
  $state['tally'] = tally_votes($state['votes'], $teams);
  echo json_encode($state, JSON_UNESCAPED_UNICODE);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$state = read_state($stateFile);

if ($method === 'GET') {
  output_state($state, $teams, $teamCount);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['error' => 'Payload JSON invalide']);
  exit;
}

$action = $payload['action'] ?? '';

if ($action === 'restart') {
  $state = default_state();
  $state['round'] = intval($state['round'] ?? 0) + 1;
  write_state($stateFile, $state);
  output_state($state, $teams, $teamCount);
}

if ($action === 'join') {
  $teamIndex = intval($payload['teamIndex'] ?? -1);
  if ($teamIndex < 0 || $teamIndex >= $teamCount) {
    http_response_code(400);
    echo json_encode(['error' => 'Équipe invalide']);
    exit;
  }

  if (!isset($state['participants']) || !is_array($state['participants'])) {
    $state['participants'] = [];
  }

  $state['participants'][strval($teamIndex)] = [
    'joinedAt' => time()
  ];
  write_state($stateFile, $state);
  output_state($state, $teams, $teamCount);
}

if ($action === 'submit') {
  $teamIndex = intval($payload['teamIndex'] ?? -1);
  if ($teamIndex < 0 || $teamIndex >= $teamCount) {
    http_response_code(400);
    echo json_encode(['error' => 'Équipe invalide']);
    exit;
  }

  $cleanVotes = valid_votes_for_team($teamIndex, $payload['photos'] ?? [], $teams);
  if (count($cleanVotes) !== 2) {
    http_response_code(400);
    echo json_encode(['error' => 'Choisissez 2 photos différentes hors de votre équipe']);
    exit;
  }

  if (!isset($state['participants']) || !is_array($state['participants'])) {
    $state['participants'] = [];
  }
  $state['participants'][strval($teamIndex)] = ['joinedAt' => time()];

  if (!isset($state['votes']) || !is_array($state['votes'])) {
    $state['votes'] = [];
  }

  $state['votes'][strval($teamIndex)] = [
    'photos' => $cleanVotes,
    'submittedAt' => time()
  ];
  write_state($stateFile, $state);
  output_state($state, $teams, $teamCount);
}

http_response_code(400);
echo json_encode(['error' => 'Action inconnue']);

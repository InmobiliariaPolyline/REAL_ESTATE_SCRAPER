<?php
/**
 * Envía avisos a la API del sistema (POST /api/ingesta) en lotes.
 *
 * Uso:   php enviar_avisos.php avisos.json
 * Env:   INGESTA_TOKEN  (obligatorio)  token secreto, el mismo que INGESTA_TOKEN en Netlify
 *        INGESTA_URL    (opcional)     por defecto https://realestatescrapeer.netlify.app/api/ingesta
 *
 * El archivo es un arreglo JSON de avisos o un objeto {"avisos": [...]}. Ver docs/SCRAPER_PROPIO.md.
 * Desde otro script PHP también puedes llamar a enviarAvisos($arregloDeAvisos).
 */

const LOTE = 200;

function enviarAvisos(array $avisos, string $url, string $token): array
{
    $total = ['recibidos' => 0, 'guardados' => 0, 'descartados' => 0];
    foreach (array_chunk($avisos, LOTE) as $lote) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
                'User-Agent: ScraperPropio/1.0',
            ],
            CURLOPT_POSTFIELDS => json_encode(['avisos' => $lote], JSON_UNESCAPED_UNICODE),
        ]);
        $cuerpo = curl_exec($ch);
        $estado = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($cuerpo === false || $estado !== 200) {
            throw new RuntimeException("La API respondió $estado " . ($error ?: (string) $cuerpo));
        }
        $r = json_decode($cuerpo, true);
        foreach (array_keys($total) as $k) {
            $total[$k] += (int) ($r[$k] ?? 0);
        }
    }
    return $total;
}

// Solo se ejecuta cuando se llama desde la línea de comandos.
if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $token = getenv('INGESTA_TOKEN');
    if (!$token) {
        fwrite(STDERR, "Falta la variable de entorno INGESTA_TOKEN\n");
        exit(1);
    }
    $archivo = $argv[1] ?? null;
    if (!$archivo || !is_file($archivo)) {
        fwrite(STDERR, "Uso: php enviar_avisos.php avisos.json\n");
        exit(1);
    }
    $datos = json_decode(file_get_contents($archivo), true);
    $avisos = is_array($datos) && isset($datos['avisos']) ? $datos['avisos'] : $datos;
    if (!is_array($avisos)) {
        fwrite(STDERR, "El archivo no tiene una lista de avisos\n");
        exit(1);
    }
    $url = getenv('INGESTA_URL') ?: 'https://realestatescrapeer.netlify.app/api/ingesta';
    try {
        $r = enviarAvisos($avisos, $url, $token);
        echo json_encode($r, JSON_PRETTY_PRINT) . PHP_EOL;
    } catch (Throwable $e) {
        fwrite(STDERR, $e->getMessage() . PHP_EOL);
        exit(1);
    }
}

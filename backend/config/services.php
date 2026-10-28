<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Lectura de boletas con la API de Claude (recepción de cargas). Sin clave, no se ofrece.
    'anthropic' => [
        'key'     => env('ANTHROPIC_API_KEY'),
        'modelo'  => env('ANTHROPIC_MODELO', 'claude-sonnet-5-5'),
        'url'     => env('ANTHROPIC_URL', 'https://api.anthropic.com/v1/messages'),
        'espera'  => (int) env('ANTHROPIC_ESPERA', 60),
    ],

    // Lectura de tickets de báscula (recepción de cargas).
    'tesseract' => [
        'bin'    => env('TESSERACT_BIN', 'tesseract'),
        'idioma' => env('TESSERACT_IDIOMA', 'eng'),
    ],

];

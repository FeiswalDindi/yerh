<?php

return [
    'mail_notifications' => filter_var(env('YERH_MAIL_NOTIFICATIONS', true), FILTER_VALIDATE_BOOL),

    'curriculum' => [
        [
            'id' => 'getting-started',
            'title' => 'Getting Started',
            'resourceTopic' => 'startups',
            'moodleCourseId' => env('YERH_MOODLE_STAGE_GETTING_STARTED'),
            'steps' => [
                [
                    'id' => 'discovery',
                    'title' => 'Customer discovery',
                    'instruction' => 'Describe the customer, their problem and what you learned from talking to them.',
                ],
                [
                    'id' => 'offer',
                    'title' => 'Offer and professional profile',
                    'instruction' => 'Draft an offer, a professional headline, an About paragraph, and three skills or project examples. Eligible students can update their own LinkedIn profile or prepare a private or paper portfolio with the school administrator.',
                ],
            ],
            'examPrompt' => 'Explain who your first customer is, how you verified their problem, and how your offer helps them.',
        ],
        [
            'id' => 'advanced',
            'title' => 'Intermediate / Advanced',
            'resourceTopic' => 'advanced',
            'moodleCourseId' => env('YERH_MOODLE_STAGE_ADVANCED'),
            'steps' => [
                [
                    'id' => 'pilot',
                    'title' => 'Run a pilot',
                    'instruction' => 'Describe your prototype or service and record what a prospective customer did or said when testing it.',
                ],
                [
                    'id' => 'pricing',
                    'title' => 'Set a price',
                    'instruction' => 'Show your delivery costs, selling price, and anticipated margin.',
                ],
            ],
            'examPrompt' => 'Explain what your pilot taught you and how your costs informed your price.',
        ],
        [
            'id' => 'funding',
            'title' => 'Funding (Aid)',
            'resourceTopic' => 'funding',
            'moodleCourseId' => env('YERH_MOODLE_STAGE_FUNDING'),
            'steps' => [
                [
                    'id' => 'cashflow',
                    'title' => 'Forecast cash flow',
                    'instruction' => 'Estimate your next three months of cash coming in and payments going out.',
                ],
                [
                    'id' => 'plan',
                    'title' => 'Choose a funding plan',
                    'instruction' => 'Explain the amount you need, how you would use it, and whether you would fund it from sales or an external source.',
                ],
            ],
            'examPrompt' => 'Describe your funding choice, projected cash needs, and the milestone this money will help you reach.',
        ],
    ],

    'default_fees' => [
        'getting-started' => 500,
        'advanced' => 750,
        'marketplace' => 1000,
    ],

    'default_sectors' => [
        ['name' => 'Agribusiness', 'image' => '/media/comfort-worms-e046b580.jpg'],
        ['name' => 'Creative enterprise', 'image' => '/media/mowrah-designs-900x599-cb3e579d.jpg'],
        ['name' => 'creatives', 'image' => null],
        ['name' => 'Fashion & design', 'image' => '/media/sued-d02d98cf.webp'],
        ['name' => 'Healthcare', 'image' => '/media/health-c8d73354.png'],
    ],

    'payment_instructions' => [
        'provider' => env('YERH_PAYMENT_PROVIDER', 'M-Pesa Paybill'),
        'paybill_number' => env('YERH_MPESA_PAYBILL', '522522'),
        'account_number' => env('YERH_MPESA_ACCOUNT', 'YERH'),
        'recipient_name' => env('YERH_PAYMENT_RECIPIENT', 'Youth Entrepreneurship Resource Hub'),
        'instructions' => env(
            'YERH_PAYMENT_INSTRUCTIONS',
            'Open M-Pesa, choose Lipa na M-Pesa → Paybill, enter the Paybill and Account number above, then enter the M-Pesa confirmation code and optionally upload a screenshot or PDF receipt below.'
        ),
    ],
];

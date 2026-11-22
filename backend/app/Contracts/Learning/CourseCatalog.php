<?php

namespace App\Contracts\Learning;

interface CourseCatalog
{
    /** @return list<array{id: int, name: string, shortName: string}> */
    public function courses(): array;
}

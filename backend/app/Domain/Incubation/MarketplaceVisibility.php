<?php

namespace App\Domain\Incubation;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class MarketplaceVisibility
{
    public function products(): Builder
    {
        return DB::table('venture_products as product')
            ->join('ventures as venture', 'venture.id', '=', 'product.venture_id')
            ->join('institutions as institution', 'institution.id', '=', 'venture.institution_id')
            ->leftJoin('incubation_paths as path', 'path.venture_id', '=', 'venture.id')
            ->leftJoin('programme_payments as payment', function ($join) {
                $join->on('payment.product_id', '=', 'product.id')->where('payment.purpose', 'marketplace');
            });
    }

    public function publicProducts(): Builder
    {
        return $this->products()
            ->where('product.moderation', 'approved')
            ->where('venture.status', 'approved')
            ->where('institution.status', 'active')
            ->whereIn('institution.kind', ['university', 'hub'])
            ->where(function ($gate) {
                $gate->where('payment.status', 'confirmed')->orWhere(function ($pathway) {
                    $pathway->whereNotNull('path.graduated_at')->where('product.evidence_status', 'approved');
                });
            })
            ->select('product.slug', 'product.name', 'product.description', 'product.price', 'venture.name as venture', 'venture.sector');
    }
}

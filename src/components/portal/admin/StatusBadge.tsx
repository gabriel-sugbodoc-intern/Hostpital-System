import React from 'react';

type StatusVariant = 
  | 'active' 
  | 'pending' 
  | 'completed' 
  | 'cancelled' 
  | 'confirmed'
  | 'waiting'
  | 'serving'
  | 'low-stock'
  | 'out-of-stock'
  | 'in-stock'
  | 'approved'
  | 'rejected'
  | 'inactive'
  | 'paid'
  | 'unpaid'
  | 'failed'
  | 'refunded'
  | 'delivered'
  | 'ready-for-pickup'
  | 'preparing'
  | 'in-progress'
  | 'no-show';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '-');
  
  const variantClasses: Record<string, string> = {
    'active': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'confirmed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'in-stock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'ready-for-pickup': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'pending': 'bg-amber-50 text-amber-700 border-amber-200',
    'waiting': 'bg-amber-50 text-amber-700 border-amber-200',
    'unpaid': 'bg-amber-50 text-amber-700 border-amber-200',
    'low-stock': 'bg-orange-50 text-orange-700 border-orange-200',
    'preparing': 'bg-blue-50 text-blue-700 border-blue-200',
    'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'completed': 'bg-gray-50 text-gray-600 border-gray-200',
    'cancelled': 'bg-red-50 text-red-700 border-red-200',
    'out-of-stock': 'bg-red-50 text-red-700 border-red-200',
    'rejected': 'bg-red-50 text-red-700 border-red-200',
    'failed': 'bg-red-50 text-red-700 border-red-200',
    'no-show': 'bg-red-50 text-red-700 border-red-200',
    'inactive': 'bg-gray-50 text-gray-500 border-gray-200',
    'refunded': 'bg-purple-50 text-purple-700 border-purple-200',
    'serving': 'bg-primary/10 text-primary border-primary/20',
    'now-serving': 'bg-primary/10 text-primary border-primary/20',
  };

  const classes = variantClasses[normalized] || 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes} ${className}`}
      data-testid={`status-${normalized}`}
    >
      {status}
    </span>
  );
}

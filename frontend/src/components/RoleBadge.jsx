import React from 'react';

const roleStyles = {
  admin: {
    bg: 'bg-[#1B1E27]',
    text: 'text-white',
    border: 'border-[#12151C]',
  },
  hr: {
    bg: 'bg-[#3B5BA9]',
    text: 'text-white',
    border: 'border-[#2B4B99]',
  },
  sales: {
    bg: 'bg-[#C98A2C]',
    text: 'text-white',
    border: 'border-[#B57A22]',
  },
  support: {
    bg: 'bg-[#2F8F8F]',
    text: 'text-white',
    border: 'border-[#257777]',
  },
  finance: {
    bg: 'bg-[#2F6F4F]',
    text: 'text-white',
    border: 'border-[#25583E]',
  },
  manager: {
    bg: 'bg-[#6B5B95]',
    text: 'text-white',
    border: 'border-[#5A4B82]',
  },
};

export const RoleBadge = ({ role, size = 'normal' }) => {
  const roleName = typeof role === 'string' ? role : role?.name || 'User';
  const normalized = roleName.toLowerCase();
  const style = roleStyles[normalized] || {
    bg: 'bg-stone-700',
    text: 'text-white',
    border: 'border-stone-800',
  };

  const sizeClasses = size === 'small' 
    ? 'text-[10px] px-1.5 py-0.5 tracking-wider' 
    : 'text-xs px-2.5 py-1 tracking-wide';

  return (
    <span
      className={`inline-flex items-center font-medium font-sans uppercase rounded-none border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
      style={{ letterSpacing: '0.05em' }}
    >
      {roleName}
    </span>
  );
};

export default RoleBadge;

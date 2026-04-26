import React from 'react';

interface StatCardProps {
  icon:  React.ReactNode;
  label: string;
  value: string | number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 hover:shadow-md transition-shadow">
    <div className="bg-slate-50 w-10 h-10 rounded-lg flex items-center justify-center">{icon}</div>
    <div>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-tight">{label}</p>
      <p className="text-xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

export default StatCard;

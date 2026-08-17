"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type DailyPoint = {
  date: string;
  views: number;
  contacts: number;
  listings: number;
};

export default function DashboardClientStats({ daily }: { daily: DailyPoint[] }) {
  const totalViews = daily.reduce((s, d) => s + d.views, 0);
  const totalContacts = daily.reduce((s, d) => s + d.contacts, 0);

  const data = daily.map((d) => ({
    label: new Date(d.date).toLocaleDateString("ar-SA", { day: "numeric", month: "short" }),
    views: d.views,
    contacts: d.contacts,
  }));

  return (
    <div className="rounded-2xl border border-black/[.08] dark:border-white/[.145] p-5 bg-white dark:bg-black/10">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2">📊 نشاطك خلال 30 يوم</h3>
          <p className="text-xs text-black/50 mt-0.5">
            المشاهدات والاتصالات على إعلاناتك يوميًا
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
            <span className="text-black/60">مشاهدات</span>
            <b>{totalViews.toLocaleString("ar-SA")}</b>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-black/60">اتصالات</span>
            <b>{totalContacts.toLocaleString("ar-SA")}</b>
          </div>
          {totalViews > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="text-black/60">معدل التحويل</span>
              <b>{((totalContacts / totalViews) * 100).toFixed(1)}%</b>
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-72">
        {totalViews + totalContacts === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-black/50 border border-dashed rounded-xl">
            لم يتم تسجيل نشاط خلال الأيام الـ 30 الماضية. ابدأ بتنظيم إعلاناتك!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="viewGradSeller" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "currentColor" }}
                strokeOpacity={0.15}
                interval={data.length > 16 ? Math.floor(data.length / 10) : 2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor" }}
                strokeOpacity={0.15}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  direction: "rtl",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="plainline"
              />
              <Line
                type="monotone"
                dataKey="views"
                name="مشاهدات الإعلانات"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                fill="url(#viewGradSeller)"
              />
              <Line
                type="monotone"
                dataKey="contacts"
                name="نقرات واتساب"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

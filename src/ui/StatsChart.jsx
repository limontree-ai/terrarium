import { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend);

export default function StatsChart({ history }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Best', data: [], borderColor: '#7ee2b8', borderWidth: 2, pointRadius: 0, tension: 0.3 },
          { label: 'Mean', data: [], borderColor: '#f7b267', borderWidth: 2, pointRadius: 0, tension: 0.3 },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#9aa', maxTicksLimit: 6 }, grid: { display: false } },
          y: { ticks: { color: '#9aa' }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true },
        },
        plugins: { legend: { labels: { color: '#cdd', boxWidth: 12 } } },
      },
    });
    return () => chartRef.current.destroy();
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    chart.data.labels = history.map((h) => h.generation);
    chart.data.datasets[0].data = history.map((h) => h.best);
    chart.data.datasets[1].data = history.map((h) => h.mean);
    chart.update();
  }, [history]);

  return (
    <div className="chart">
      <canvas ref={canvasRef} />
    </div>
  );
}

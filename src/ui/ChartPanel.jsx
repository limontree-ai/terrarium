import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

/**
 * Reward per generation. history = [{ round, currentReward, bestReward }].
 */
export function ChartPanel({ history }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    const ctx = chartRef.current?.getContext?.("2d");
    if (!ctx) return undefined;

    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Current", data: [], borderColor: "#c8a8f0", tension: 0.3, pointRadius: 0 },
          { label: "Best variation", data: [], borderColor: "#3498db", tension: 0.3, pointRadius: 0 },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: true, labels: { color: "#fff" } } },
        scales: {
          x: { ticks: { color: "#aab", maxTicksLimit: 6 } },
          y: { ticks: { color: "#aab" } },
        },
      },
    });

    return () => {
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;
    chart.data.labels = history.map((h) => h.round);
    chart.data.datasets[0].data = history.map((h) => h.currentReward);
    chart.data.datasets[1].data = history.map((h) => h.bestReward);
    chart.update("none");
  }, [history]);

  return (
    <div className="chart-panel">
      <canvas ref={chartRef} />
    </div>
  );
}

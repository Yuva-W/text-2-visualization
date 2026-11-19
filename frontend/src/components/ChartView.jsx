import { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const COLORS = [
    "#c9f27a",
    "#79d7e8",
    "#f6c177",
    "#f78da7",
    "#b7a6f7",
    "#6ee7b7",
    "#f4a261",
    "#f5e6a3",
];

const CHART_TYPES = ["bar", "line", "pie"];

function ChartView({ chart }) {
    const [chartType, setChartType] = useState(chart.chartType);
    const supportsPie = (chart.series?.length || 0) === 1;
    const availableChartTypes = supportsPie
        ? CHART_TYPES
        : CHART_TYPES.filter((type) => type !== "pie");

    useEffect(() => {
        // Reset the local toggle when a different chart is selected, and never
        // show a pie toggle for a multi-series chart because a pie can only
        // faithfully display one series.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChartType(
            chart.chartType === "pie" && !supportsPie
                ? "bar"
                : chart.chartType
        );
    }, [chart, supportsPie]);

    const { rows, seriesKeys } = useMemo(() => {
        const series = chart.series || [];
        const labelIndex = new Map();
        const nextRows = [];

        series.forEach((item, seriesIndex) => {
            item.data.forEach((point) => {
                let row = labelIndex.get(point.label);

                if (!row) {
                    row = { __label: point.label };
                    labelIndex.set(point.label, row);
                    nextRows.push(row);
                }

                row[`series_${seriesIndex}`] = point.value;
            });
        });

        return {
            rows: nextRows,
            seriesKeys: series.map((item, index) => ({
                key: `series_${index}`,
                name: item.name,
                color: COLORS[index % COLORS.length],
            })),
        };
    }, [chart]);

    const pieData = useMemo(() => {
        const firstSeries = chart.series?.[0];
        return (firstSeries?.data || []).map((point, index) => ({
            name: point.label,
            value: point.value,
            fill: COLORS[index % COLORS.length],
        }));
    }, [chart]);

    if (!rows.length) {
        return (
            <p className="p-6 text-sm text-mist">
                This chart does not contain any data points.
            </p>
        );
    }

    const tooltipStyle = {
        backgroundColor: "#0e1922",
        border: "1px solid #334b57",
        borderRadius: "10px",
        color: "#e8eef2",
        fontSize: "12px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
    };

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-2">
                {availableChartTypes.map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setChartType(type)}
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                            chartType === type
                                ? "bg-signal text-ink-950"
                                : "border border-line text-mist hover:border-glacier/60 hover:text-chalk"
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === "pie" ? (
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="35%"
                                outerRadius="75%"
                                paddingAngle={2}
                                stroke="#0a1117"
                                labelLine={false}
                                label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                                    const radians = (-midAngle * Math.PI) / 180;
                                    const radius = outerRadius * 1.12;
                                    const x = cx + radius * Math.cos(radians);
                                    const y = cy + radius * Math.sin(radians);

                                    return (
                                        <text
                                            x={x}
                                            y={y}
                                            fill="#e8eef2"
                                            fontSize={11}
                                            textAnchor={x > cx ? "start" : "end"}
                                            dominantBaseline="central"
                                        >
                                            {`${name} ${Math.round(percent * 100)}%`}
                                        </text>
                                    );
                                }}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`${entry.name}-${index}`}
                                        fill={entry.fill}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={tooltipStyle}
                                labelStyle={{ color: "#91a3ae" }}
                                itemStyle={{ color: "#e8eef2" }}
                            />
                            <Legend
                                wrapperStyle={{
                                    color: "#91a3ae",
                                    fontSize: "12px",
                                }}
                            />
                        </PieChart>
                    ) : chartType === "line" ? (
                        <LineChart data={rows}>
                            <CartesianGrid stroke="#22343e" strokeDasharray="3 3" />
                            <XAxis
                                dataKey="__label"
                                stroke="#617582"
                                tick={{ fill: "#91a3ae", fontSize: 12 }}
                            />
                            <YAxis
                                stroke="#617582"
                                tick={{ fill: "#91a3ae", fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                labelStyle={{ color: "#91a3ae" }}
                                itemStyle={{ color: "#e8eef2" }}
                            />
                            {seriesKeys.length > 1 && (
                                <Legend
                                    wrapperStyle={{
                                        color: "#91a3ae",
                                        fontSize: "12px",
                                    }}
                                />
                            )}
                            {seriesKeys.map((series) => (
                                <Line
                                    key={series.key}
                                    type="monotone"
                                    dataKey={series.key}
                                    name={series.name}
                                    stroke={series.color}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <BarChart data={rows}>
                            <CartesianGrid stroke="#22343e" strokeDasharray="3 3" />
                            <XAxis
                                dataKey="__label"
                                stroke="#617582"
                                tick={{ fill: "#91a3ae", fontSize: 12 }}
                            />
                            <YAxis
                                stroke="#617582"
                                tick={{ fill: "#91a3ae", fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                labelStyle={{ color: "#91a3ae" }}
                                itemStyle={{ color: "#e8eef2" }}
                            />
                            {seriesKeys.length > 1 && (
                                <Legend
                                    wrapperStyle={{
                                        color: "#91a3ae",
                                        fontSize: "12px",
                                    }}
                                />
                            )}
                            {seriesKeys.map((series) => (
                                <Bar
                                    key={series.key}
                                    dataKey={series.key}
                                    name={series.name}
                                    fill={series.color}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>

            {(chart.xLabel || chart.yLabel) && (
                <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                    {[chart.xLabel, chart.yLabel].filter(Boolean).join(" · ")}
                </p>
            )}
        </div>
    );
}

export default ChartView;

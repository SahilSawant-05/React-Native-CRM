import React from "react";
import Chart from "react-apexcharts";

const LineChart = () => {
  const options = {
    chart: {
      id: "balance-chart"
    },
    xaxis: {
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    },
    colors: ["#34c38f", "#f46a6a"]
  };

  const series = [
    {
      name: "Revenue",
      data: [20, 40, 35, 50, 70, 90]
    },
    {
      name: "Expenses",
      data: [15, 30, 25, 40, 60, 80]
    }
  ];

  return (
    <Chart options={options} series={series} type="line" height={300} />
  );
};
export default LineChart
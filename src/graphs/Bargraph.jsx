import React from "react";
import Chart from "react-apexcharts";

const BarChart = () => {
  const options = {
    chart: {
      id: "sales-bar"
    },
    xaxis: {
      categories: ["Goal", "Pending", "Revenue"]
    },
    colors: ["#556ee6", "#34c38f", "#f1b44c"]
  };

  const series = [
    {
      name: "Amount",
      data: [37, 12, 18]
    }
  ];

  return (
    <Chart options={options} series={series} type="bar" height={300} />
  );
};

export default BarChart;
import React from "react";
import ApexCharts from "apexcharts";
import Chart from "react-apexcharts";

const RadarChart = () => {
  const options = {
    chart: {
      type: "radar"
    },
    xaxis: {
      categories: ["2016", "2017", "2018", "2019", "2020", "2021"]
    }
  };

  const series = [
    {
      name: "Won",
      data: [40, 60, 80, 30, 20, 50]
    },
    {
      name: "Loss",
      data: [20, 30, 40, 70, 10, 20]
    }
  ];

  return (
    <Chart options={options} series={series} type="radar" height={300} />
  );
};
export default RadarChart;
import React from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ExportButton = ({ data, fileName }) => {
  const handleExport = () => {
    // 1. Create a worksheet from the JSON data
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // 2. Create a new workbook and append the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    
    // 3. Generate the buffer and save the file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blobData = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
    });
    
    saveAs(blobData, `${fileName}.xlsx`);
  };

  return (
    <button onClick={handleExport} className="export-btn">
      Export Contacts
    </button>
  );
};

export default ExportButton;

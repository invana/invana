import Papa from "papaparse";

/**
 * Reads a CSV file from an input event and returns JSON.
 * @param {File} file - The uploaded CSV file.
 * @returns {Promise<Array>} - A Promise that resolves to JSON data.
 */
export const parseCSVFile = (file) => {
  /*
   USAGE:
    > const data = await parseCSVFile(file);

  */
  return new Promise((resolve, reject) => {
    if (!file) {
      reject("No file provided");
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file);

    reader.onload = () => {
      Papa.parse(reader.result, {
        header: true, // Treat first row as headers
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    };

    reader.onerror = (error) => reject(error);
  });
};
import { IconDownload, IconFileSpreadsheet, IconLoader2 } from '@tabler/icons-react';
import { type MRT_ColumnDef, MantineReactTable, useMantineReactTable } from 'mantine-react-table';
import React, { useContext, useEffect, useMemo, useState } from 'react';



import { getFileDownloadUrls } from '@/services/agentService';



import HomeContext from '@/pages/api/home/home.context';



import { Alert, Button, Center, Group, Loader, MantineProvider, Text, useMantineTheme } from '@mantine/core';
import Papa from 'papaparse';
import { getAgentLog } from '@/utils/app/agent';


interface Props {
  filePath: string;
  message: any;
}

const AgentTableBlock: React.FC<Props> = ({ filePath, message }) => {
  const { state: { lightMode } } = useContext(HomeContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [originalFileName, setOriginalFileName] = useState('');

  const handleDownloadCSV = () => {
    if (!data.length) return;
    const csvContent = Papa.unparse(data);
    const fileName = originalFileName || 'data.csv';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData([]);
    const fetchTableData = async () => {
      let agentLog = getAgentLog(message);
      if (!agentLog?.data?.files) {
        setError('No agent files found in message');
        setLoading(false);
        return;
      }

      try {
        const fileName = filePath.split('/').pop() || '';
        setOriginalFileName(fileName);

        const { data: agentLogData } = agentLog;

        let fileId: string | null = null;
        for (const [id, fileData] of Object.entries(agentLogData.files)) {
          // @ts-ignore
          if (fileData.original_name === fileName) {
            fileId = id;
            break;
          }
        }

        if (!fileId) {
          setError(`File "${fileName}" not found in agent files`);
          setLoading(false);
          return;
        }

        const urls = await getFileDownloadUrls({
          files: [fileId],
          sessionId: agentLogData.session,
        });

        if (!urls?.data?.[fileId]) {
          setError('Failed to get download URL');
          setLoading(false);
          return;
        }

        const downloadUrl = urls.data[fileId];
        const response = await fetch(downloadUrl);
        const text = await response.text();

        // Debug: Log first few lines of the file to help diagnose issues
        console.log('File content preview:', text.substring(0, 500));
        console.log('File length:', text.length);
        
        // Additional debugging: analyze file structure
        const lines = text.split('\n').slice(0, 5); // First 5 lines
        console.log('First 5 lines:', lines);
        console.log('Line count:', text.split('\n').length);
        
        // Check for common issues
        if (text.length === 0) {
          setError('The file appears to be empty.');
          setLoading(false);
          return;
        }
        
        if (text.length < 10) {
          setError('The file is too small to contain valid CSV data.');
          setLoading(false);
          return;
        }
        
        // Check if it looks like a binary file
        const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/;
        if (binaryPattern.test(text.substring(0, 100))) {
          setError('The file appears to be binary or contains non-text data. Please ensure you\'re uploading a text-based CSV file.');
          setLoading(false);
          return;
        }

        // Try multiple delimiters in order of preference
        const delimitersToTry = ['', ',', ';', '\t', '|'];
        let parseSuccess = false;
        let lastError: any = null;

        // Check if the file appears to have headers
        const firstLine = lines[0] || '';
        const hasHeaders = !firstLine.match(/^[\d\s,;|\t.-]+$/); // If first line is only numbers and separators, probably no headers

        for (const delimiter of delimitersToTry) {
          try {
            await new Promise<void>((resolve, reject) => {
              Papa.parse(text, {
                header: hasHeaders, // Use headers only if detected
                dynamicTyping: true,
                delimiter: delimiter,
                skipEmptyLines: true,
                transformHeader: (header: string) => header.trim(),
                transform: (value: string) => value.trim(),
                complete: (results: { errors: string | any[]; data: any[]; meta: any }) => {
                  console.log(`Trying delimiter: "${delimiter || 'auto'}" with headers: ${hasHeaders}`, results.meta);
                  
                  // Check if parsing was successful
                  const errors = Array.isArray(results.errors) ? results.errors : [results.errors];
                  const criticalErrors = errors.filter((error: any) => 
                    error && (
                      error.type === 'Delimiter' || 
                      (error.type === 'FieldMismatch' && error.code === 'TooFewFields')
                    )
                  );
                  
                  // Consider parsing successful if we have data and no critical errors
                  if (results.data && results.data.length > 0 && criticalErrors.length === 0) {
                    let filteredData = results.data.filter((row) =>
                      Object.values(row).some((val) => val !== null && val !== ''),
                    );
                    
                    // If no headers were detected, create column names
                    if (!hasHeaders && filteredData.length > 0) {
                      const firstRow = filteredData[0];
                      if (Array.isArray(firstRow)) {
                        // Convert array data to object with column names
                        filteredData = filteredData.map((row: any[]) => {
                          const obj: any = {};
                          row.forEach((value, index) => {
                            obj[`Column ${index + 1}`] = value;
                          });
                          return obj;
                        });
                      }
                    }
                    
                    if (filteredData.length > 0) {
                      console.log(`Successfully parsed with delimiter: "${delimiter || 'auto'}" (headers: ${hasHeaders})`);
                      setData(filteredData);
                      setLoading(false);
                      parseSuccess = true;
                      resolve();
                      return;
                    }
                  }
                  
                  // Store the error for potential use later
                  if (criticalErrors.length > 0) {
                    lastError = criticalErrors[0];
                  }
                  
                  reject(new Error(`Failed with delimiter: ${delimiter || 'auto'}`));
                },
                error: (error: { message: any }) => {
                  console.log(`Parse error with delimiter "${delimiter || 'auto'}":`, error.message);
                  reject(new Error(error.message));
                },
              });
            });
            
            // If we get here, parsing was successful
            break;
            
          } catch (err) {
            console.log(`Failed to parse with delimiter "${delimiter || 'auto'}":`, err);
            continue;
          }
        }

        // If none of the delimiters worked, show helpful error
        if (!parseSuccess) {
          let errorMessage = 'Could not parse the file as CSV. ';
          
          // Provide more specific guidance based on file analysis
          const firstLine = lines[0] || '';
          const hasCommas = firstLine.includes(',');
          const hasSemicolons = firstLine.includes(';');
          const hasTabs = firstLine.includes('\t');
          const hasPipes = firstLine.includes('|');
          
          if (lastError) {
            if (lastError.type === 'Delimiter') {
              errorMessage += 'The file format is not recognized as CSV. ';
              
              // Suggest likely delimiters based on content
              if (hasCommas || hasSemicolons || hasTabs || hasPipes) {
                errorMessage += 'Detected possible separators: ';
                const separators = [];
                if (hasCommas) separators.push('commas');
                if (hasSemicolons) separators.push('semicolons');
                if (hasTabs) separators.push('tabs');
                if (hasPipes) separators.push('pipes');
                errorMessage += separators.join(', ') + '. ';
              }
              
              errorMessage += 'Please ensure the file uses standard CSV formatting.';
            } else if (lastError.code === 'TooFewFields') {
              errorMessage += `Row ${lastError.row + 1} has inconsistent column count. Please check the file for missing data or formatting issues.`;
            } else {
              errorMessage += `Parse error: ${lastError.message}`;
            }
          } else {
            // No specific error, provide general guidance
            if (lines.length === 1) {
              errorMessage += 'The file appears to have only one line. CSV files typically need multiple rows of data.';
            } else if (lines.length === 2 && !lines[1].trim()) {
              if (!hasHeaders) {
                errorMessage += 'The file appears to contain only one row of data with no headers. Consider adding column headers as the first row, or the data might be incomplete.';
              } else {
                errorMessage += 'The file appears to have headers but no data rows.';
              }
            } else if (firstLine.length > 1000) {
              errorMessage += 'The first line is very long, which might indicate the file is not properly formatted as CSV.';
            } else if (!hasCommas && !hasSemicolons && !hasTabs && !hasPipes) {
              errorMessage += 'No common CSV separators (commas, semicolons, tabs, pipes) were detected in the first line.';
            } else {
              errorMessage += 'The file might be corrupted, in an unsupported format, or have formatting issues.';
            }
          }
          
          console.log('Final error analysis:', { 
            firstLine, 
            hasCommas, 
            hasSemicolons, 
            hasTabs, 
            hasPipes, 
            lines, 
            hasHeaders,
            lineCount: lines.length 
          });
          setError(errorMessage);
          setLoading(false);
        }
      } catch (err) {
        setError(`Failed to load table data: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    fetchTableData();
  }, [filePath, message]);

  const columns: MRT_ColumnDef<any>[] = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      accessorKey: key,
      header: key,
      enableColumnFilter: true,
    }));
  }, [data]);

  const table = useMantineReactTable({
    columns,
    data,
    enableGlobalFilter: true,
    enableColumnFilters: true,
    enableSorting: true,
    mantineTableContainerProps: {
      style: {
        maxHeight: 500,
        backgroundColor: lightMode ? '#FFFFFF' : '#1A1B1E',
      },
    },
    mantineTableHeadProps: {
      sx: {
        backgroundColor: lightMode ? '#F8F9FA' : '#141517',
      },
    },
    mantineTableBodyRowProps: ({ row }) => ({
      sx: {
        backgroundColor: lightMode 
          ? (row.index % 2 === 0 ? '#FFFFFF' : '#F8F9FA')
          : (row.index % 2 === 0 ? '#1A1B1E' : '#141517'),
        '&:hover': {
          backgroundColor: lightMode ? '#E7F5FF' : '#0D4785',
        },
      },
    }),
    mantineTableHeadCellProps: {
      sx: {
        color: lightMode ? '#212529' : '#FFFFFF',
        fontWeight: 600,
        borderBottom: `1px solid ${lightMode ? '#DEE2E6' : '#373A40'}`,
      },
    },
    mantineTableBodyCellProps: {
      sx: {
        color: lightMode ? '#495057' : '#C1C2C5',
        borderBottom: `1px solid ${lightMode ? '#E9ECEF' : '#2C2E33'}`,
      },
    },
    mantinePaperProps: {
      sx: {
        backgroundColor: lightMode ? '#FFFFFF' : '#1A1B1E',
        boxShadow: 'none',
      },
    },
    mantineToolbarAlertBannerProps: {
      color: 'indigo',
    },
    mantineFilterTextInputProps: {
      sx: {
        input: {
          backgroundColor: lightMode ? '#FFFFFF' : '#25262B',
          borderColor: lightMode ? '#CED4DA' : '#373A40',
          color: lightMode ? '#212529' : '#FFFFFF',
          '&:focus': {
            borderColor: '#4DABF7',
          },
        },
      },
    },
    mantineSearchTextInputProps: {
      sx: {
        input: {
          backgroundColor: lightMode ? '#FFFFFF' : '#25262B',
          borderColor: lightMode ? '#CED4DA' : '#373A40',
          color: lightMode ? '#212529' : '#FFFFFF',
          '&:focus': {
            borderColor: '#4DABF7',
          },
        },
      },
    },
    mantinePaginationProps: {
      sx: {
        color: lightMode ? '#495057' : '#FFFFFF',
      },
    },
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
    enableStickyHeader: true,
    state: { isLoading: loading },
  });

  if (loading) {
    return (
        <Center style={{ 
          padding: 24, 
          backgroundColor: lightMode ? '#FFFFFF' : '#1A1B1E',
          borderRadius: 8,
          margin: '1rem',
          border: `1px solid ${lightMode ? '#DEE2E6' : '#373A40'}`
        }}>
          <Loader color={lightMode ? '#228BE6' : '#4DABF7'} size="xl" variant="bars" />
          <Text ml="md" color={lightMode ? '#212529' : '#FFFFFF'}>Loading table data...</Text>
        </Center>
    );
  }

  if (error) {
    return (
        <Alert 
          color="red" 
          variant={lightMode ? "light" : "filled"}
          styles={{
            root: {
              margin: 16,
              backgroundColor: lightMode ? '#FFEEEE' : '#5C0011',
              color: lightMode ? '#7D0A0A' : '#FFCDCD'
            }
          }}
        >
          {error}
        </Alert>
    );
  }

  if (!data.length) {
    return (
        <Alert 
          color="yellow" 
          variant={lightMode ? "light" : "filled"}
          styles={{
            root: {
              margin: 16,
              backgroundColor: lightMode ? '#FFF8E6' : '#553A10',
              color: lightMode ? '#7D6608' : '#FFE8A8'
            }
          }}
        >
          No data found in CSV file.
        </Alert>
    );
  }

  return (
      <MantineProvider theme={{
        // Explicitly set the colorScheme based on the app's lightMode state
        colorScheme: lightMode ? 'light' : 'dark',
        primaryColor: 'blue',
        colors: {
          // Shared blue palette for both light and dark modes
          blue: [
            '#E7F5FF', 
            '#D0EBFF', 
            '#A5D8FF', 
            '#74C0FC', 
            '#4DABF7', 
            '#339AF0', 
            '#228BE6', 
            '#1C7ED6', 
            '#1971C2', 
            '#0D4785',
          ],
          // Dark theme colors
          dark: [
            '#C1C2C5', // 0: text color
            '#A6A7AB', // 1
            '#909296', // 2
            '#5C5F66', // 3: borders
            '#373A40', // 4
            '#2C2E33', // 5: hover state
            '#25262B', // 6: inputs
            '#1A1B1E', // 7: main background
            '#141517', // 8: alternate rows
            '#101113', // 9
          ],
          // Light theme colors
          gray: [
            '#F8F9FA', // 0: lightest background
            '#F1F3F5', // 1
            '#E9ECEF', // 2
            '#DEE2E6', // 3: light borders
            '#CED4DA', // 4
            '#ADB5BD', // 5
            '#868E96', // 6: secondary text
            '#495057', // 7: primary text
            '#343A40', // 8
            '#212529', // 9: dark text
          ]
        },
        // Component-specific overrides
        components: {
          Button: {
            styles: {
              root: {
                backgroundColor: lightMode ? '#228BE6' : 'transparent',
                color: lightMode ? 'white' : '#4DABF7',
                borderColor: lightMode ? 'transparent' : '#4DABF7',
              }
            }
          },
          Text: {
            styles: {
              root: {
                color: lightMode ? '#212529' : '#C1C2C5',
              }
            }
          },
          Alert: {
            styles: {
              root: {
                backgroundColor: lightMode ? '#F8F9FA' : '#25262B',
                color: lightMode ? '#212529' : '#C1C2C5',
              }
            }
          }
        }
      }} withGlobalStyles withNormalizeCSS>
        <div
            style={{
              margin: '1rem',
              padding: '0.75rem',
              borderRadius: 8,
              backgroundColor: lightMode ? '#FFFFFF' : '#1A1B1E',
              boxShadow: lightMode 
                ? '0 1px 5px rgba(0,0,0,0.1)' 
                : '0 1px 5px rgba(0,0,0,0.4)',
              border: `1px solid ${lightMode ? '#E9ECEF' : '#373A40'}`,
            }}
        >
          <Group position="apart" mb="md">
            <Group spacing="xs">
              <IconFileSpreadsheet size={22} color={lightMode ? '#228BE6' : '#4DABF7'} />
              <Text weight={600} size="md" color={lightMode ? '#212529' : '#FFFFFF'}>
                {originalFileName}
              </Text>
            </Group>
            <Group spacing="sm" align="center">
              <Text size="sm" color={lightMode ? '#868E96' : '#A6A7AB'} weight={500}>
                {data.length} rows
              </Text>
              <Button
                  variant={lightMode ? "filled" : "outline"}
                  color="blue"
                  size="sm"
                  onClick={handleDownloadCSV}
                  leftIcon={<IconDownload size={18} />}
                  styles={{
                    root: {
                      backgroundColor: lightMode ? '#228BE6' : 'transparent',
                      borderColor: lightMode ? 'transparent' : '#4DABF7',
                      color: lightMode ? 'white' : '#4DABF7',
                      '&:hover': {
                        backgroundColor: lightMode ? '#1971C2' : '#0D4785',
                        borderColor: lightMode ? 'transparent' : '#4DABF7',
                      },
                    },
                  }}
              >
                Download
              </Button>
            </Group>
          </Group>
          <MantineReactTable table={table} />
        </div>
      </MantineProvider>
  );
};

export default AgentTableBlock;
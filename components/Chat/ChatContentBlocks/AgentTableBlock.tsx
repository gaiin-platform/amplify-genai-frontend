import { IconDownload, IconFileSpreadsheet, IconLoader2 } from '@tabler/icons-react';
import { type MRT_ColumnDef, MantineReactTable, useMantineReactTable } from 'mantine-react-table';
import React, { useContext, useEffect, useMemo, useState } from 'react';



import { getFileDownloadUrls } from '@/services/agentService';



import HomeContext from '@/pages/api/home/home.context';



import { Alert, Button, Center, Group, Loader, MantineProvider, Text, useMantineTheme } from '@mantine/core';
import Papa from 'papaparse';


interface Props {
  filePath: string;
  message: any;
}

const AgentTableBlock: React.FC<Props> = ({ filePath, message }) => {
  const { state: { lightMode } } = useContext(HomeContext);
  const theme = useMantineTheme();

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
      if (!message?.data?.state?.agentLog?.data?.files) {
        setError('No agent files found in message');
        setLoading(false);
        return;
      }

      try {
        const fileName = filePath.split('/').pop() || '';
        setOriginalFileName(fileName);

        const { data: agentLogData } = message.data.state.agentLog;

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

        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          complete: (results: { errors: string | any[]; data: any[] }) => {
            if (results.errors && results.errors.length > 0) {
              setError(`Parse error: ${results.errors[0].message}`);
              setLoading(false);
              return;
            }
            const filteredData = results.data.filter((row) =>
              Object.values(row).some((val) => val !== null && val !== ''),
            );
            setData(filteredData);
            setLoading(false);
          },
          error: (error: { message: any }) => {
            setError(`Error parsing CSV: ${error.message}`);
            setLoading(false);
          },
        });
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
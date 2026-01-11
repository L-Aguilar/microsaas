import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Badge } from './badge';

// Función helper para renderizar HTML de forma segura
const renderHtmlSafely = (content: React.ReactNode): React.ReactNode => {
  // Si es un string con HTML, usar el portal
  if (typeof content === 'string' && content.includes('<')) {
    return <HtmlRendererPortal html={content} />;
  }
  
  // Si es un elemento React, verificar si tiene children con HTML
  if (React.isValidElement(content)) {
    const children = content.props.children;
    if (typeof children === 'string' && children.includes('<')) {
      // Clonar el elemento pero con el HTML procesado
      return React.cloneElement(content, {
        ...content.props,
        children: <HtmlRendererPortal html={children} />
      });
    }
  }
  
  return content;
};

// Componente que usa portal para renderizar HTML sin escape
const HtmlRendererPortal = ({ html }: { html: string }) => {
  const [container] = useState(() => document.createElement('div'));
  
  useEffect(() => {
    container.innerHTML = html;
  }, [html, container]);
  
  return createPortal(container as any, document.body);
};

export interface Column<T> {
  key: string;
  header: string;
  accessor: (item: T) => any;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  itemsPerPage?: number;
  onRowClick?: (item: T) => void;
  className?: string;
  pageSizeOptions?: number[];
  loading?: boolean;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  itemsPerPage = 10,
  onRowClick,
  className = "",
  pageSizeOptions = [10, 25],
  loading = false,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(itemsPerPage);

  // Actualizar pageSize cuando cambia itemsPerPage
  useEffect(() => {
    setPageSize(itemsPerPage);
    setCurrentPage(1); // Reset a la primera página
  }, [itemsPerPage]);

  // Agregar columna de acciones si onEdit o onDelete están presentes
  const columnsWithActions = useMemo(() => {
    if (!onEdit && !onDelete) {
      return columns;
    }

    const actionsColumn: Column<T> = {
      key: 'actions',
      header: 'Acciones',
      accessor: () => '',
      render: (_, item) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
              className="h-8 w-8 p-0"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    };

    return [...columns, actionsColumn];
  }, [columns, onEdit, onDelete]);

  // Filtrar datos (solo usar columnas originales, excluir columna de acciones)
  const filteredData = useMemo(() => {
    let filtered = data;

    // Aplicar búsqueda global (excluir columna de acciones)
    if (searchTerm) {
      filtered = filtered.filter(item =>
        columns.some(column => {
          const value = column.accessor(item);
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Aplicar filtros específicos
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        const column = columns.find(col => col.key === key);
        if (column) {
          filtered = filtered.filter(item => {
            const itemValue = column.accessor(item);
            return itemValue?.toString().toLowerCase().includes(value.toLowerCase());
          });
        }
      }
    });

    return filtered;
  }, [data, searchTerm, filters, columns]);

  // Ordenar datos (puede usar columnsWithActions para ordenar por columna de acciones)
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    const column = columnsWithActions.find(col => col.key === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = column.accessor(a);
      const bValue = column.accessor(b);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection, columnsWithActions]);

  // Paginación
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Manejar ordenamiento
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Manejar filtros
  const handleFilterChange = (columnKey: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setSortColumn(null);
    setSortDirection('asc');
    setCurrentPage(1);
  };

  // Manejar cambio de tamaño de página
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset a la primera página
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="whitespace-nowrap"
          >
            Limpiar
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Mostrar:</span>
            <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(Number(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-gray-500">
            {filteredData.length} de {data.length} registros
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {columnsWithActions.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-sm font-medium text-gray-700 ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                    } ${column.width || ''} ${column.key === 'actions' ? 'text-right' : ''}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className={`flex items-center gap-2 ${column.key === 'actions' ? 'justify-end' : ''}`}>
                      <span>{column.header}</span>
                      {column.sortable && (
                        <div className="flex flex-col">
                          {sortColumn === column.key && sortDirection === 'asc' && (
                            <ChevronUp className="h-3 w-3" />
                          )}
                          {sortColumn === column.key && sortDirection === 'desc' && (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={columnsWithActions.length} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      <p>Cargando datos...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columnsWithActions.map((column) => (
                      <td 
                        key={column.key} 
                        className={`px-4 py-3 text-sm text-gray-900 ${column.key === 'actions' ? 'text-right' : ''}`}
                      >
                        {renderHtmlSafely(
                          column.render
                            ? column.render(column.accessor(item), item)
                            : (() => {
                                const value = column.accessor(item);
                                return value?.toString() || '-';
                              })()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columnsWithActions.length} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <p>No hay datos para mostrar</p>
                      <p className="text-xs text-gray-400">Verifica que estés autenticado y que haya datos disponibles</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Mostrando {startIndex + 1} a {Math.min(endIndex, sortedData.length)} de {sortedData.length} resultados
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 7;
                  
                  if (totalPages <= maxVisiblePages) {
                    // Mostrar todas las páginas si hay pocas
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={currentPage === i ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(i)}
                          className="w-8 h-8 p-0"
                        >
                          {i}
                        </Button>
                      );
                    }
                  } else {
                    // Mostrar páginas con elipsis
                    if (currentPage <= 4) {
                      // Páginas iniciales
                      for (let i = 1; i <= 5; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={currentPage === i ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(i)}
                            className="w-8 h-8 p-0"
                          >
                            {i}
                          </Button>
                        );
                      }
                      pages.push(<span key="dots1" className="px-2">...</span>);
                      pages.push(
                        <Button
                          key={totalPages}
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8 p-0"
                        >
                          {totalPages}
                        </Button>
                      );
                    } else if (currentPage >= totalPages - 3) {
                      // Páginas finales
                      pages.push(
                        <Button
                          key={1}
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          className="w-8 h-8 p-0"
                        >
                          1
                        </Button>
                      );
                      pages.push(<span key="dots2" className="px-2">...</span>);
                      for (let i = totalPages - 4; i <= totalPages; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={currentPage === i ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(i)}
                            className="w-8 h-8 p-0"
                          >
                            {i}
                          </Button>
                        );
                      }
                    } else {
                      // Páginas intermedias
                      pages.push(
                        <Button
                          key={1}
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          className="w-8 h-8 p-0"
                        >
                          1
                        </Button>
                      );
                      pages.push(<span key="dots3" className="px-2">...</span>);
                      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={currentPage === i ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(i)}
                            className="w-8 h-8 p-0"
                          >
                            {i}
                          </Button>
                        );
                      }
                      pages.push(<span key="dots4" className="px-2">...</span>);
                      pages.push(
                        <Button
                          key={totalPages}
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8 p-0"
                        >
                          {totalPages}
                        </Button>
                      );
                    }
                  }
                  
                  return pages;
                })()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

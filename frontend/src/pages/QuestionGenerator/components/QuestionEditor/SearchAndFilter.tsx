// frontend/src/pages/QuestionGenerator/components/QuestionEditor/SearchAndFilter.tsx

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Search, FilterList } from '@mui/icons-material';
import { QuestionEditorState } from '@/types/editor';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '@/types/editor';

/**
 * SearchAndFilter组件的Props接口
 */
interface SearchAndFilterProps {
  searchQuery: string;
  filterOptions: QuestionEditorState['filterOptions'];
  onSearchChange: (query: string) => void;
  onFilterChange: (filters: Partial<QuestionEditorState['filterOptions']>) => void;
  statistics: {
    total: number;
    modified: number;
    invalid: number;
    byType: Record<string, number>;
    byDifficulty: Record<string, number>;
  };
}

/**
 * 搜索和过滤组件
 * 提供题目的搜索和多维度过滤功能
 */
export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  filterOptions,
  onSearchChange,
  onFilterChange,
  statistics
}) => {
  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          搜索和过滤
        </Typography>
        
        <Grid container spacing={2}>
          {/* 搜索框 */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索题目内容、标签..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>

          {/* 题目类型过滤 */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>题目类型</InputLabel>
              <Select
                multiple
                value={filterOptions.types}
                onChange={(e) => onFilterChange({ types: e.target.value as string[] })}
                input={<OutlinedInput label="题目类型" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={QUESTION_TYPE_LABELS[value as keyof typeof QUESTION_TYPE_LABELS]} 
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label} ({statistics.byType[value] || 0})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 难度过滤 */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>难度级别</InputLabel>
              <Select
                multiple
                value={filterOptions.difficulties}
                onChange={(e) => onFilterChange({ difficulties: e.target.value as string[] })}
                input={<OutlinedInput label="难度级别" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={DIFFICULTY_LABELS[value as keyof typeof DIFFICULTY_LABELS]} 
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label} ({statistics.byDifficulty[value] || 0})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 其他过滤选项 */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filterOptions.modifiedOnly}
                    onChange={(e) => onFilterChange({ modifiedOnly: e.target.checked })}
                    size="small"
                  />
                }
                label={`只显示已修改 (${statistics.modified})`}
              />
            </Box>
          </Grid>
        </Grid>

        {/* 统计信息 */}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            共 {statistics.total} 道题目，{statistics.modified} 道已修改，{statistics.invalid} 道有错误
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
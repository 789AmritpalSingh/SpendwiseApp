
import {
  Box,
  Grid,
  Card,
  CardContent,
  Skeleton,
  Stack,
} from "@mui/material";

export default function DashboardSkeleton() {
  return (
    <Box>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Skeleton variant="text" width={260} height={48} />
        <Skeleton variant="text" width={210} />
      </Stack>

      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((item) => (
          <Grid
            key={item}
            size={{ xs: 12, sm: 6, lg: 3 }}
          >
            <Card>
              <CardContent>
                <Skeleton width="60%" height={24} />
                <Skeleton width="75%" height={45} />
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Skeleton width={200} height={30} />
              <Skeleton
                variant="rounded"
                height={270}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Skeleton width={180} height={30} />
              <Skeleton
                variant="circular"
                width={200}
                height={200}
                sx={{ mx: "auto", mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Skeleton width={240} height={30} />
              {[1, 2, 3].map((item) => (
                <Skeleton
                  key={item}
                  height={40}
                  sx={{ mt: 1 }}
                />
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

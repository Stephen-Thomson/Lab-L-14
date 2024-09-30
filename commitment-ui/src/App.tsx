import React from 'react'
import { Typography, Container, } from '@mui/material'
import CommitmentForm from './components/CommitmentForm'

const App: React.FC = () => {
  return (
    <Container maxWidth="sm" style={{ marginTop: '1em' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        iCommit
      </Typography>
      <CommitmentForm />
    </Container>
  )
}

export default App

import { Patient } from '../../types';

export type PortalPatient = Pick<Patient, 'id' | 'name' | 'email' | 'phone' | 'dni' | 'birthDate'>;

import { MAIN_API_BASE_URL } from '../config/api';

const API_BASE_URL = MAIN_API_BASE_URL;

class ApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      let errorMessage = 'Request failed';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  async login(username: string, password: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  // Station methods
  async getStations(page: number = 1, limit: number = 10, search?: string) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }
      
      const url = `${API_BASE_URL}/stations?${params.toString()}`;
      console.log('API call to:', url);
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async createStation(data: { station_name: string; station_code: string }) {
    try {
      const response = await fetch(`${API_BASE_URL}/stations`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async updateStation(id: number, data: { station_name: string; station_code: string }) {
    try {
      const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async deleteStation(id: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async clearAllStations() {
    try {
      const response = await fetch(`${API_BASE_URL}/stations`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  // Train route methods
  async getTrainRoutes(page: number = 1, limit: number = 10, search?: string) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await fetch(`${API_BASE_URL}/train-routes?${params.toString()}`, {
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async createTrainRoute(data: {
    train_number: string;
    train_name: string;
    start_station_id: number;
    end_station_id: number;
  }) {
    try {
      const response = await fetch(`${API_BASE_URL}/train-routes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async updateTrainRoute(id: number, data: {
    train_number: string;
    train_name: string;
    start_station_id: number;
    end_station_id: number;
  }) {
    try {
      const response = await fetch(`${API_BASE_URL}/train-routes/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async deleteTrainRoute(id: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/train-routes/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }

  async clearAllTrainRoutes() {
    try {
      const response = await fetch(`${API_BASE_URL}/train-routes`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  }
}

export const apiService = new ApiService();
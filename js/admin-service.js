const AdminService = {
    async request(path, options = {}) {
        const res = await fetch(`${API_BASE_URL}/admin${path}`, {
            ...options,
            headers: {
                ...API.getHeaders(true),
                ...(options.headers || {})
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401) API.logout();
            const error = new Error(data.error || 'No se pudo completar la solicitud administrativa.');
            error.status = res.status;
            throw error;
        }
        return data;
    },

    getMe() {
        return this.request('/me');
    },

    getSummary() {
        return this.request('/summary');
    },

    getClinics() {
        return this.request('/clinics');
    },

    updateClinic(id, data) {
        return this.request(`/clinics/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    getPatients() {
        return this.request('/patients');
    },

    getTutors() {
        return this.request('/tutors');
    },

    getPlans() {
        return this.request('/plans');
    },

    getFeedback() {
        return this.request('/feedback');
    },

    updateFeedback(id, data) {
        return this.request(`/feedback/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    getTickets() {
        return this.request('/tickets');
    },

    updateTicket(id, data) {
        return this.request(`/tickets/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    getPayments() {
        return this.request('/payments');
    },

    createManualPayment(data) {
        return this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    updatePayment(id, data) {
        return this.request(`/payments/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    getUsageMetrics() {
        return this.request('/usage-metrics');
    },

    getSupportUsers() {
        return this.request('/support-users');
    },

    getActivity() {
        return this.request('/activity');
    },

    getAlerts() {
        return this.request('/alerts');
    },

    async sendPasswordRecovery(email) {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: API.getHeaders(false),
            body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo enviar la recuperacion.');
        return data;
    }
};

window.AdminService = AdminService;

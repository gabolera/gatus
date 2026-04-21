import {createRouter, createWebHistory} from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/Home.vue')
    },
    {
        path: '/endpoints/:key',
        name: 'EndpointDetails',
        component: () => import('@/views/EndpointDetails.vue'),
    },
    {
        path: '/suites/:key',
        name: 'SuiteDetails',
        component: () => import('@/views/SuiteDetails.vue')
    }
];

const router = createRouter({
    history: createWebHistory(process.env.BASE_URL),
    routes
});

export default router;
